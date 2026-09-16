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
}

/** The endpoint both servers answer on. */
export const ROUTE = "/__notes";

export type Where = "file" | "inbox" | "browser";

/** One store, keyed so two prototypes on one origin do not share a browser
 *  fallback. */
export function notesStore(localKey = "proto-bar:notes") {
  function fromLocal(): Note[] {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? (JSON.parse(raw) as Note[]) : [];
    } catch {
      return [];
    }
  }

  function shape(body: unknown): { notes: Note[]; where: Where } | null {
    const b = body as { store?: string; notes?: Note[] } | null;
    if (!b || !Array.isArray(b.notes)) return null;
    return { notes: b.notes, where: b.store === "inbox" ? "inbox" : "file" };
  }

  async function load(): Promise<{ notes: Note[]; where: Where }> {
    try {
      const res = await fetch(ROUTE, { headers: { Accept: "application/json" } });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("application/json")) {
        const parsed = shape(await res.json());
        if (parsed) {
          // Anything stranded in this browser from a session before the
          // endpoint existed comes along, rather than sitting there unread.
          const stray = fromLocal().filter((n) => !parsed.notes.some((x) => x.id === n.id));
          if (stray.length) {
            const merged = [...parsed.notes, ...stray];
            await save(merged);
            try {
              localStorage.removeItem(localKey);
            } catch {
              // Saved server-side; a stale local copy is harmless.
            }
            return { notes: merged, where: parsed.where };
          }
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
      const res = await fetch(ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes),
      });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("application/json")) {
        const body = (await res.json()) as { ok?: boolean; store?: string };
        if (body?.ok) {
          // The server has it, and the browser keeps a copy in case this
          // machine is the only place it ever existed.
          try {
            localStorage.setItem(localKey, JSON.stringify(notes));
          } catch {
            // Server-side is the one that matters.
          }
          return body.store === "inbox" ? "inbox" : "file";
        }
      }
    } catch {
      // Fall through to the browser.
    }
    try {
      localStorage.setItem(localKey, JSON.stringify(notes));
    } catch {
      // Nothing left to try. The panel reports "browser" and Copy all is the
      // way out.
    }
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
      return `${i + 1}. [${where}]${n.done ? " (done)" : ""}\n   ${n.text}`;
    })
    .join("\n");
}
