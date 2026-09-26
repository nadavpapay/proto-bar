// ─── The rules every notes server keeps ───────────────────────────────────────
//
// Shared by `vite-notes.ts` (the dev server) and `next-notes.ts` (a Next route).
// `server.cjs` carries its own plain-JS copy of the same rules, because it has
// to run with nothing but `node` — change one, change the other.
//
// THE PUBLIC LINK SHOWS EVERYTHING. It is a deployment of the repo, so it has
// the repo's `notes.json` baked in, read-only. What reviewers do there is kept
// as ENTRIES in an inbox on the server's own volume — a note as it was written
// or edited there, or a record that one was deleted there — and what the link
// shows is the repo's notes with the entries laid over them.
//
// THE DEV SERVER COLLECTS, THEN MARKS. It copies every entry it has not seen
// into the repo file and tells the inbox which ones it took. Marked, not
// deleted: the public link keeps showing them until the repo file it has baked
// in has caught up — which is the next deploy, so a marked entry stops counting
// once the server has restarted since it was marked. Deleting on collect is what
// made collected notes vanish from the link, and what lost a "done" ticked there
// on a note already collected.
//
// NOTHING IS RESURRECTED. A delete on the link is an entry, collected like any
// other, so a note removed there is removed in the repo too; and a note removed
// in the repo is gone from the link after the deploy that carries the removal.
//
// NEVER DELETE WHAT HOLDS A STATUS. Collecting moves things into the repo; it
// must not be the thing that wipes a mark the link is still reading (EDLock lost
// its "ready" marks that way). Marking rather than deleting is that rule.

/** A note, as far as a server needs to know one. The full shape is
 *  `src/notes/store.ts`. */
export interface Note {
  id: string;
  [k: string]: unknown;
}

/** What the inbox holds: a note as it was last written on the public link, or
 *  the fact that it was deleted there. */
export type Entry = (Note | { id: string; deleted: true }) & {
  /** When the public link wrote it — the collect names it back, so an entry
   *  rewritten after the dev server read it is not marked as taken. */
  saved: string;
  /** When the dev server took it into the repo file. */
  collected?: string;
};

export const MAX_NOTES = 500; // the endpoint is public, so it has a ceiling
const MAX_TEXT = 4000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const isDeleted = (e: Entry): e is Entry & { deleted: true } =>
  (e as { deleted?: unknown }).deleted === true;

function strip(e: Entry): Note {
  const { saved: _s, collected: _c, ...note } = e;
  return note as Note;
}

/** Key order is not meaning — two copies of one note must compare equal
 *  whichever way round their fields were written. */
function same(a: Note | undefined, b: Note): boolean {
  if (!a) return false;
  const norm = (n: Note) => JSON.stringify(Object.keys(n).sort().map((k) => [k, n[k]]));
  return norm(a) === norm(b);
}

/** Does this entry still say something the repo file does not? An uncollected
 *  one always does. A collected one does until the server restarts after it
 *  was collected — a restart is a deploy, and a deploy brings the repo file. */
export function live(e: Entry, started: string): boolean {
  return !e.collected || e.collected > started;
}

/** The repo's notes with the inbox laid over them. Pass `""` for `started` to
 *  apply every entry given. */
export function overlay(base: Note[], entries: Entry[], started: string): Note[] {
  const out = new Map(base.map((n) => [n.id, n]));
  for (const e of entries) {
    if (!live(e, started)) continue;
    if (isDeleted(e)) out.delete(e.id);
    else out.set(e.id, strip(e));
  }
  return [...out.values()];
}

/** A reviewer posted the whole list as they see it, each note already through
 *  `clean`. Whatever differs from the view they were shown becomes an entry; whatever is missing from it becomes
 *  a delete. Entries that are no longer live are dropped on the way. */
export function record(
  view: Note[],
  posted: Note[],
  entries: Entry[],
  started: string,
  now: string,
): Entry[] {
  const out = new Map(entries.filter((e) => live(e, started)).map((e) => [e.id, e]));
  const shown = new Map(view.map((n) => [n.id, n]));
  const kept = new Set<string>();
  for (const n of posted) {
    kept.add(n.id);
    // Compared as cleaned, so a repo note carrying a field of the job's own does
    // not read as changed every time anyone posts.
    const was = shown.get(n.id);
    if (!same(was ? (clean(was) ?? undefined) : undefined, n)) out.set(n.id, { ...n, saved: now });
  }
  for (const n of view) if (!kept.has(n.id)) out.set(n.id, { id: n.id, deleted: true, saved: now });
  return [...out.values()];
}

/** The dev server took these. Only an entry still as it was read is marked. */
export function mark(entries: Entry[], taken: { id: string; saved: string }[], now: string): Entry[] {
  const seen = new Map(taken.map((t) => [t.id, t.saved]));
  return entries.map((e) => (!e.collected && seen.get(e.id) === e.saved ? { ...e, collected: now } : e));
}

/** A note from a public endpoint, kept only if it is the shape a note has.
 *  Anyone can post to a deployed link, so every field is checked and capped. */
export function clean(raw: unknown): Note | null {
  const n = raw as Record<string, unknown> | null;
  if (!n || typeof n !== "object") return null;
  if (typeof n.id !== "string" || !ID.test(n.id)) return null;
  if (typeof n.text !== "string" || typeof n.screen !== "string" || typeof n.viewport !== "string") return null;
  if (typeof n.x !== "number" || typeof n.y !== "number" || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return null;
  const note: Note = {
    id: n.id,
    screen: n.screen.slice(0, 200),
    viewport: n.viewport.slice(0, 40),
    x: n.x,
    y: n.y,
    text: n.text.slice(0, MAX_TEXT),
    at: typeof n.at === "string" ? n.at.slice(0, 40) : new Date().toISOString(),
  };
  if (n.done === true) note.done = true;
  if (typeof n.by === "string" && n.by.trim()) note.by = n.by.trim().slice(0, 80);
  if (typeof n.scope === "string" && n.scope) note.scope = n.scope.slice(0, 80);
  if (n.context && typeof n.context === "object") {
    const ctx: Record<string, string> = {};
    for (const [k, v] of Object.entries(n.context).slice(0, 12))
      if (typeof v === "string") ctx[k.slice(0, 40)] = v.slice(0, 120);
    note.context = ctx;
  }
  return note;
}

/** One write at a time. Two posts in the same instant would otherwise both read
 *  the old file and the second write would drop the first one's note. */
export function queue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const next = tail.then(job, job);
    tail = next.catch(() => {});
    return next;
  };
}
