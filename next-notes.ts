// ─── The notes endpoint, as a Next.js route ───────────────────────────────────
//
// `vite-notes.ts` and `server.cjs` folded into one handler, for a prototype that
// lives inside a Next app. Copy this file and `notes-sync.ts` into the project,
// then make a route:
//
//   // app/api/notes/route.ts
//   import { notesRoute } from "@/proto-bar/next-notes";
//   export const { GET, POST } = notesRoute({ file: "notes.json", inbox: "https://…/api/notes" });
//   export const runtime = "nodejs";
//   export const dynamic = "force-dynamic";
//
// and give the page the same address: `useNotesStore({ route: "/api/notes" })`.
//
// IT KNOWS WHICH SERVER IT IS. Under `next dev` it is the dev server: notes go
// straight into `file` in the repo, and every read first collects from `inbox`
// (the public deployment's own copy of this route). In production it is the
// public link: the repo file is baked into the build and read-only, so what
// reviewers do lands in an inbox on the volume (`NOTES_DIR`, or `/data` when a
// volume is mounted there), and what the link shows is the repo file with the
// inbox laid over it. The rules are in `notes-sync.ts`.
//
// One file per route. A project with several decks makes one route per deck,
// or a `[deck]` route that builds a handler per deck with its own `file`.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAX_NOTES,
  clean,
  live,
  mark,
  overlay,
  queue,
  record,
  type Entry,
  type Note,
} from "./notes-sync";

const TIMEOUT = 2500; // the collect is a convenience on top of a file read, never a dependency of it
// A collected entry counts until the server restarts after it was collected: a
// restart is a deploy, and a deploy brings a repo file that already has it.
const STARTED = new Date().toISOString();

async function readList<T>(file: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // no file yet is not an error — it is the first review
  }
}

/** Temp file then rename: a half-written notes file is worse than no notes
 *  file, and rename is the only atomic operation a filesystem gives you. */
async function writeList(file: string, list: unknown[]) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(list, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function notesRoute({
  file = "notes.json",
  inbox,
}: {
  /** The repo file, relative to the project root. */
  file?: string;
  /** The deployed copy of this route, to collect from while developing. */
  inbox?: string;
} = {}) {
  const repo = path.join(process.cwd(), file);
  const dir = process.env.NOTES_DIR || (existsSync("/data") ? "/data" : process.cwd());
  const box = path.join(dir, `${path.basename(file, ".json")}-inbox.json`);
  const public_ = process.env.NODE_ENV === "production";
  const serial = queue();

  async function collect(local: Note[]): Promise<Note[]> {
    if (!inbox) return local;
    try {
      const res = await fetch(`${inbox}?inbox=1`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT),
        cache: "no-store",
      });
      if (!res.ok) return local;
      const body = (await res.json()) as { entries?: Entry[] };
      const entries = Array.isArray(body?.entries) ? body.entries.filter((e) => e?.id) : [];
      if (entries.length === 0) return local;
      const merged = overlay(local, entries, "");
      await fetch(`${inbox}?collected=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries.map((e) => ({ id: e.id, saved: e.saved }))),
        signal: AbortSignal.timeout(TIMEOUT),
      }).catch(() => {});
      console.log(`[notes] collected ${entries.length} change${entries.length === 1 ? "" : "s"} from the public link`);
      return merged;
    } catch {
      return local; // offline, or the deployment is down — local notes are unaffected
    }
  }

  async function GET(req: Request): Promise<Response> {
    if (public_) {
      const entries = await readList<Entry>(box);
      // The dev server's collect: what it has not taken yet, stamps and all.
      if (new URL(req.url).searchParams.get("inbox"))
        return reply({ store: "inbox", entries: entries.filter((e) => !e.collected) });
      return reply({ store: "inbox", notes: overlay(await readList<Note>(repo), entries, STARTED) });
    }
    const notes = await serial(async () => {
      const local = await readList<Note>(repo);
      const merged = await collect(local);
      if (merged !== local) await writeList(repo, merged);
      return merged;
    });
    return reply({ store: "file", notes });
  }

  async function POST(req: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return reply({ ok: false, error: "not JSON" }, 400);
    }
    if (!Array.isArray(body)) return reply({ ok: false, error: "not an array" }, 400);

    if (!public_) {
      await serial(() => writeList(repo, body as Note[]));
      return reply({ ok: true, store: "file", notes: body });
    }

    const collected = !!new URL(req.url).searchParams.get("collected");
    return serial(async () => {
      const now = new Date().toISOString();
      const entries = (await readList<Entry>(box)).filter((e) => live(e, STARTED));
      if (collected) {
        await writeList(box, mark(entries, body as { id: string; saved: string }[], now));
        return reply({ ok: true });
      }
      const base = await readList<Note>(repo);
      // One bad note and nothing is applied: a list with a note missing reads
      // as that note deleted.
      const posted = (body as unknown[]).map(clean);
      if (posted.some((n) => !n)) return reply({ ok: false, error: "not a list of notes" }, 400);
      const next = record(overlay(base, entries, STARTED), posted as Note[], entries, STARTED, now);
      if (next.length > MAX_NOTES) return reply({ ok: false, error: "too many notes" }, 400);
      await writeList(box, next);
      return reply({ ok: true, store: "inbox", notes: overlay(base, next, STARTED) });
    });
  }

  return { GET, POST };
}
