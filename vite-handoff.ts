// ─── The handoff, handed to the bar ───────────────────────────────────────────
//
//   import config from "./handoff.config.ts";
//   import { handoff } from "./vite-handoff.ts";
//   plugins: [react(), tailwindcss(), handoff(config)]
//
// Serves `virtual:handoff`: the config, the commit the page is built from, the
// notes as HTML and the changes parsed. Every file a screen names is checked
// here, so a screen that moved stops the build rather than linking to nothing.
// The notes and changes are re-read when they are saved, and the page reloads.
//
// Dev-only dependency: `marked`, which turns the markdown into HTML here so the
// page ships none.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Marked } from "marked";
import type { Plugin, ViteDevServer } from "vite";
import { dirOf, parseChanges, sectionIds, sectionOf, type HandoffConfig, type HandoffData } from "./src/handoff/config.ts";

const ID = "virtual:handoff";
const RESOLVED = "\0" + ID;

function commit(root: string) {
  if (process.env.HANDOFF_SHA) return process.env.HANDOFF_SHA;
  try {
    return execSync("git rev-parse HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "main";
  }
}

/** Headings written `## Title {#id}` get the id, and lose the braces. */
function withIds(html: string) {
  return html.replace(/<h([1-6])>(.*?)\s*\{#([\w-]+)\}<\/h\1>/g, '<h$1 id="$3">$2</h$1>');
}

export function handoff(config: HandoffConfig, options: { root?: string } = {}): Plugin {
  const root = options.root ?? process.cwd();
  const md = new Marked();
  let built = false;
  const at = (p: string) => resolve(root, p);
  const isFile = (p: string) => existsSync(at(p)) && statSync(at(p)).isFile();

  function data(fail: (msg: string) => never): HandoffData {
    for (const p of [config.notes, config.changes, ...(config.product ? [config.product] : [])])
      if (!isFile(p)) fail(`handoff: ${p} does not exist`);
    for (const p of config.shared ?? []) if (!isFile(p)) fail(`handoff: shared file ${p} does not exist`);

    const notes = readFileSync(at(config.notes), "utf8").replace(/<!--[\s\S]*?-->\n*/g, "");
    const ids = new Set(sectionIds(notes));
    for (const [key, s] of Object.entries(config.screens)) {
      for (const f of s.files) if (!isFile(f)) fail(`handoff: ${key} names ${f}, which does not exist`);
      for (const n of s.notes ?? []) if (!ids.has(n)) fail(`handoff: ${key} carries notes section ${n}, which ${config.notes} does not have`);
    }
    for (const n of [...(config.everywhere ?? []), ...(config.fakes ? [config.fakes] : [])])
      if (!sectionOf(notes, n)) fail(`handoff: ${config.notes} has no section ${n}`);

    const changes = parseChanges(readFileSync(at(config.changes), "utf8")).map((g) => ({
      ...g,
      changes: g.changes.map((c) => ({
        ...c,
        html: md.parse(c.body) as string,
        impactHtml: c.impact ? (md.parseInline(c.impact) as string) : "",
      })),
    }));

    return {
      name: config.name,
      slug: config.slug,
      version: config.version.replace(/^v/, ""),
      address: dirOf(config.address),
      page: new URL(dirOf(config.address)).pathname,
      repo: config.repo,
      sha: commit(root),
      folder: config.folder ?? ".handoff",
      built,
      product: !!config.product,
      shared: config.shared ?? [],
      screens: Object.fromEntries(
        Object.entries(config.screens).map(([key, s]) => [
          key,
          { title: s.title, files: s.files, notes: s.notes ?? [], states: s.states },
        ]),
      ),
      notesHtml: withIds(md.parse(notes) as string),
      changes,
    };
  }

  const watched = [config.notes, config.changes].map(at);

  return {
    name: "handoff",
    config(_, env) {
      built = env.command === "build";
    },
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      return `export default ${JSON.stringify(data((msg) => this.error(msg)))}`;
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(watched);
      server.watcher.on("change", (file) => {
        if (!watched.includes(file)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
