// ─── Where a note lives ───────────────────────────────────────────────────────
//
// Three stores, and which one is in use is a fact the panel shows rather than
// hides, because they do not offer the same promise:
//
//   THE FILE — `notes.json` beside the source, through the dev server (see
//   `vite-notes.ts`). It is in git, so "look at the notes and fix them" needs
//   nothing but the sentence.
//
//   THE INBOX — a file on the public deployment's own volume (see `server.cjs`).
//   Notes written on the public link go here, survive its redeploys, and are
//   collected into the repo file the next time the dev server is asked for
//   notes. Nothing is lost and nothing has to be copied; it just arrives later.
//
//   THE BROWSER — localStorage, and only a genuine last resort: a page with no
//   endpoint behind it, or a network that is down mid-review. Notes here are
//   real and survive a reload, but they are inside one browser and have to be
//   sent over with Copy all.
//
// THE BROWSER IS NOT A MIRROR. It holds notes only while a server could not be
// reached, and is emptied the moment one takes them. A browser that kept a copy
// of every save would hand a note deleted in the repo straight back to the
// server the next time that reviewer opened the link.
//
// The endpoints answer with `{ store, notes }` rather than a bare array. A
// static server answers unknown paths with index.html and a 200, so a response
// only counts when it is actually JSON of that shape — without the check a
// static build would look writable, accept notes, and drop them.

/** A note: a pin on a place on a screen, and what was said about it. */
export interface Note {
  id: string;
  /** The screen it was dropped on — whatever id your prototype uses. */
  screen: string;
  /** `desktop` / `mobile`, or whatever your viewports are called. A note is
   *  shown on the screen AND viewport it was written on, and nowhere else: a
   *  pin measured on a 390px phone means nothing on a 1440px desktop. */
  viewport: string;
  /**
   * Everything else the shell needs to reopen the note where it was written —
   * a version, a state, which answer to an open question was up. RECORDED, NOT
   * FILTERED: a note about a table row is about that row in any state, and a
   * pin that vanishes when a selector moves reads as a lost note. What it is
   * for is the jump back, and the line under the note in the list.
   */
  context?: Record<string, string>;
  /**
   * Which overlay it was written on, and absent when it was written on the
   * plain screen. A dialog is centred in the window while the page grows and
   * shrinks with its rows, so a note measured against the page slides off a
   * dialog the moment the table is filtered. The name comes off the overlay's
   * own `data-note-scope` attribute — see `NotesLayer.tsx`.
   */
  scope?: string;
  /** Percent of the box the note was written on — the screen's own content
   *  box, or the overlay's when `scope` is set. */
  x: number;
  y: number;
  text: string;
  /** ISO. Order matters more than the clock. */
  at: string;
  done?: boolean;
  /** Who wrote it — the name they gave the composer, remembered per browser. A
   *  file of notes from three reviewers with no names is a file nobody can
   *  answer. */
  by?: string;
}

/** The address the notes servers answer on unless told otherwise. A Next app
 *  uses its own route — see `next-notes.ts`. */
export const ROUTE = "/__notes";

export type Where = "file" | "inbox" | "browser";

/** One store. `localKey` so two prototypes on one origin do not share a
 *  browser fallback; `route` for a server that answers somewhere else. */
export function notesStore({
  route = ROUTE,
  localKey = "proto-bar:notes",
}: { route?: string; localKey?: string } = {}) {
  function fromLocal(): Note[] {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? (JSON.parse(raw) as Note[]) : [];
    } catch {
      return [];
    }
  }

  function toLocal(notes: Note[] | null) {
    try {
      if (notes) localStorage.setItem(localKey, JSON.stringify(notes));
      else localStorage.removeItem(localKey);
    } catch {
      // Nothing left to try. The panel reports "browser" and Copy all is the
      // way out.
    }
  }

  function shape(body: unknown): { notes: Note[]; where: Where } | null {
    const b = body as { store?: string; notes?: Note[] } | null;
    if (!b || !Array.isArray(b.notes)) return null;
    return { notes: b.notes, where: b.store === "inbox" ? "inbox" : "file" };
  }

  async function load(): Promise<{ notes: Note[]; where: Where }> {
    try {
      // Never from a cache — a CDN or Next's fetch cache answering with an old
      // list is a note that looks lost.
      const res = await fetch(route, { headers: { Accept: "application/json" }, cache: "no-store" });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("application/json")) {
        const parsed = shape(await res.json());
        if (parsed) {
          // Anything written here while no server could be reached comes along
          // now, rather than sitting in this browser unread.
          const stray = fromLocal().filter((n) => !parsed.notes.some((x) => x.id === n.id));
          if (stray.length) {
            const merged = [...parsed.notes, ...stray];
            const landed = await save(merged);
            return { notes: merged, where: landed };
          }
          toLocal(null);
          return parsed;
        }
      }
    } catch {
      // No endpoint, or offline. Either way the browser is the store.
    }
    return { notes: fromLocal(), where: "browser" };
  }

  /** Returns where it actually landed, which is not always where it landed
   *  last time — a dev server can be restarted out from under an open tab. */
  async function save(notes: Note[]): Promise<Where> {
    try {
      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes),
      });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("application/json")) {
        const body = (await res.json()) as { ok?: boolean; store?: string };
        if (body?.ok) {
          // A server has them, so this browser lets go.
          toLocal(null);
          return body.store === "inbox" ? "inbox" : "file";
        }
      }
    } catch {
      // Fall through to the browser.
    }
    toLocal(notes);
    return "browser";
  }

  return { load, save };
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `n${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** What gets copied when there is no file to write to. Plain text on purpose:
 *  it is going into a chat message, and JSON in a chat message is something
 *  somebody has to read past rather than read. */
export function asText(notes: Note[]): string {
  return notes
    .map((n, i) => {
      const ctx = Object.entries(n.context ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      const where = `${n.screen} · ${n.viewport}${ctx ? ` · ${ctx}` : ""}${n.scope ? ` · on “${n.scope}”` : ""}`;
      const who = n.by ? ` — ${n.by}` : "";
      return `${i + 1}. [${where}]${who}${n.done ? " (done)" : ""}\n   ${n.text}`;
    })
    .join("\n");
}

/** "Dana · 24 Sep" — who and when is enough on a review. Spelled out rather
 *  than left to the browser, which writes "Sept" in some places. */
export function byline(n: Note): string {
  const d = new Date(n.at);
  const when = Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return [n.by, when].filter(Boolean).join(" · ");
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
