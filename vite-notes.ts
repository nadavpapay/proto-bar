// ─── The notes endpoint, on the dev server ────────────────────────────────────
//
// You review a screen, drop a pin on the thing that is wrong, and type what you
// mean. Then you say "look at the notes" to the agent, and it reads them — no
// copying, no pasting, no screenshot in between. That only works if the notes
// land in a FILE IN THE REPO, so this is the dev server that puts them there.
//
// TWO PLACES A NOTE CAN BE WRITTEN, ONE PLACE IT ENDS UP.
//
//   Here, on the dev server → straight into `notes.json`, which is in git.
//
//   On the public link → into an inbox on that server's own volume (see
//   `server.cjs`, or `next-notes.ts`), since it has no way to reach this repo.
//   When `inbox` is set, this middleware COLLECTS from it every time it is asked
//   for notes: lays whatever the link has not handed over yet onto `notes.json`
//   — new notes, edits, "done", deletes — and tells the inbox which it took.
//   The rules are in `notes-sync.ts`.
//
// `apply: "serve"` — dev server only. Add it to `vite.config.ts`:
//
//   plugins: [react(), tailwindcss(), notesFile({ inbox: "https://…/__notes" })]

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { overlay, queue, type Entry, type Note } from "./notes-sync.ts";

/** The collect must never make the local endpoint slow or fragile — it is a
 *  convenience on top of a file read, not a dependency of it. */
const INBOX_TIMEOUT = 2500;

async function collect(inbox: string, local: Note[]): Promise<Note[]> {
  try {
    const res = await fetch(`${inbox}?inbox=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(INBOX_TIMEOUT),
    });
    if (!res.ok) return local;
    const body = (await res.json()) as { entries?: Entry[] };
    const entries = Array.isArray(body?.entries) ? body.entries.filter((e) => e?.id) : [];
    if (entries.length === 0) return local;

    const merged = overlay(local, entries, "");
    // Named back with the stamp each was read at, so an entry rewritten on the
    // link a second ago is not marked as taken.
    await fetch(`${inbox}?collected=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries.map((e) => ({ id: e.id, saved: e.saved }))),
      signal: AbortSignal.timeout(INBOX_TIMEOUT),
    }).catch(() => {});

    console.log(`[notes] collected ${entries.length} change${entries.length === 1 ? "" : "s"} from the public link`);
    return merged;
  } catch {
    // Offline, or the deployment is down. Local notes are unaffected.
    return local;
  }
}

export function notesFile({
  file = "notes.json",
  route = "/__notes",
  inbox,
}: {
  /** Relative to the Vite root. */
  file?: string;
  /** Where the page asks for notes — pass the same to `useNotesStore`. */
  route?: string;
  /** The deployed server's notes route, to collect from. Off when absent. */
  inbox?: string;
} = {}): Plugin {
  return {
    name: "proto-bar-notes",
    apply: "serve",
    configureServer(server) {
      const dest = path.join(server.config.root, file);
      const serial = queue();

      const read = async (): Promise<Note[]> => {
        try {
          const parsed = JSON.parse(await readFile(dest, "utf8"));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          // No file yet is not an error — it is the first review.
          return [];
        }
      };

      /**
       * Written the long way round on purpose. These are the only record of a
       * review, rewritten in full on every change, and the two ways to lose
       * them are a crash halfway through a write and a bug that posts an
       * empty array over a full file:
       *   · the previous contents are kept as `notes.json.bak` first, so the
       *     last good state always exists on disk;
       *   · the new contents go to a temp file and are RENAMED into place,
       *     which is atomic — a reader sees the old file or the new one.
       */
      const write = async (notes: Note[]) => {
        const previous = await readFile(dest, "utf8").catch(() => null);
        if (previous) await writeFile(`${dest}.bak`, previous, "utf8");
        const tmp = `${dest}.tmp`;
        await writeFile(tmp, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
        await rename(tmp, dest);
      };

      server.middlewares.use(route, async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (req.method === "GET") {
          const notes = await serial(async () => {
            const local = await read();
            if (!inbox) return local;
            const merged = await collect(inbox, local);
            if (merged !== local) await write(merged);
            return merged;
          });
          res.end(JSON.stringify({ store: "file", notes }));
          return;
        }

        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          try {
            const notes = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!Array.isArray(notes)) throw new Error("not an array");
            await serial(() => write(notes));
            res.end(JSON.stringify({ ok: true, store: "file", notes }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false }));
      });
    },
  };
}
