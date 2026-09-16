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
//   `server.cjs`), since it has no way to reach this repo. When `inbox` is
//   set, this middleware DRAINS it every time it is asked for notes: copies
//   anything new into `notes.json`, then deletes exactly what it copied. So a
//   note taken on a phone at the weekend is in the repo the next time the dev
//   server is used. Draining rather than syncing is deliberate — a two-way
//   sync would resurrect notes that were deliberately deleted here.
//
// `apply: "serve"` — dev server only. Add it to `vite.config.ts`:
//
//   plugins: [react(), tailwindcss(), notesFile({ inbox: "https://…/__notes" })]

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const ROUTE = "/__notes";

/** The drain must never make the local endpoint slow or fragile — it is a
 *  convenience on top of a file read, not a dependency of it. */
const INBOX_TIMEOUT = 2500;

interface Note {
  id: string;
  [k: string]: unknown;
}

async function drain(inbox: string, existing: Note[]): Promise<Note[]> {
  try {
    const res = await fetch(inbox, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(INBOX_TIMEOUT),
    });
    if (!res.ok) return existing;
    const body = (await res.json()) as { notes?: Note[] };
    const incoming = Array.isArray(body?.notes) ? body.notes : [];
    if (incoming.length === 0) return existing;

    const known = new Set(existing.map((n) => n.id));
    const fresh = incoming.filter((n) => n?.id && !known.has(n.id));

    // Delete everything that was seen, not only what was new: an id already in
    // the file is a note that has been collected before, and leaving it in the
    // inbox means draining it again forever.
    await fetch(`${inbox}?ids=${incoming.map((n) => n.id).join(",")}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(INBOX_TIMEOUT),
    }).catch(() => {});

    if (fresh.length) console.log(`[notes] collected ${fresh.length} from the public link`);
    return [...existing, ...fresh];
  } catch {
    // Offline, or the deployment is down. Local notes are unaffected.
    return existing;
  }
}

export function notesFile({
  file = "notes.json",
  inbox,
}: {
  /** Relative to the Vite root. */
  file?: string;
  /** The deployed server's `/__notes`, to collect from. Off when absent. */
  inbox?: string;
} = {}): Plugin {
  return {
    name: "proto-bar-notes",
    apply: "serve",
    configureServer(server) {
      const dest = path.join(server.config.root, file);

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

      server.middlewares.use(ROUTE, async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method === "GET") {
          const local = await read();
          const merged = inbox ? await drain(inbox, local) : local;
          if (merged.length !== local.length) await write(merged);
          res.end(JSON.stringify({ store: "file", notes: merged }));
          return;
        }

        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          try {
            const notes = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!Array.isArray(notes)) throw new Error("not an array");
            await write(notes);
            res.end(JSON.stringify({ ok: true, store: "file", count: notes.length }));
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
