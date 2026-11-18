// ─── The pack: what a developer's coding agent is handed ──────────────────────
//
//   vite build && node handoff-pack.mts [--dist dist] [--base /] [--config handoff.config.ts]
//
// Run after the build, from the same commit. It writes beside the built handoff
// page:
//
//   pack.zip     everything below, in one folder per handoff
//   pack/        the same pieces one by one, for the bar's Download list
//   llms.txt     where an agent that fetches the page is sent, since the page
//                needs JavaScript and an agent reads it without running it
//
// and inside the zip, under `<folder>/<slug>/` (`.handoff/shop/`):
//
//   AGENTS.md         how to work from the folder, the decisions that hold everywhere
//   CLAUDE.md         points at AGENTS.md
//   screens/*.md      one brief per screen: its states, what to read, its rules
//   shots/            a picture of every state, to check the result against
//   source/           the source a brief can name, without what only the prototype needs
//   changes/*.md      one brief per change, for a developer who built the last version
//   PRODUCT.md        where it goes in the product, when the config names one
//   notes.md, changes.md, VERSION
//
// plus a `.gitignore` that keeps the whole folder out of the developer's repo
// and out of their agent's searches.
//
// Nothing here is written twice. The states come from `handoff.config.ts`, the
// files from its screens and the rules from the notes, and anything a brief
// names that is not there stops the build rather than shipping a link to
// nothing. The pack says which commit it is, so it refuses to build from
// uncommitted files (`--dirty` to try it anyway). Outside git, give the commit
// as HANDOFF_SHA.
//
// Pictures need a Chrome: `puppeteer-core` (a dev dependency) drives one over a
// pipe, so it ends when this script does, however it ends. Set HANDOFF_CHROME to
// its path, or get one with
//   npx @puppeteer/browsers install chrome-headless-shell@stable
// `--no-shots` builds the pack without pictures.
//
// Needs `zip` and, for the change briefs, `git` on the path.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { dirOf, fileName, parseChanges, sectionOf, type HandoffConfig } from "./src/handoff/config.ts";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const at = argv.indexOf(name);
  return at < 0 ? undefined : argv[at + 1];
};
const fail = (msg: string): never => {
  console.error(`pack: ${msg}`);
  process.exit(1);
};

const configPath = resolve(flag("--config") ?? "handoff.config.ts");
if (!existsSync(configPath)) fail(`no ${relative(process.cwd(), configPath)}; name it with --config`);
const root = dirname(configPath);
const config = ((await import(pathToFileURL(configPath).href)) as { default: HandoffConfig }).default;

const address = dirOf(config.address);
const page = new URL(address).pathname;
const base = dirOf(flag("--base") ?? "/");
if (!page.startsWith(base)) fail(`the handoff's path ${page} is not under the build's base ${base}`);
const dist = resolve(root, flag("--dist") ?? "dist");
const out = join(dist, page.slice(base.length));
if (!existsSync(join(out, "index.html"))) fail(`no built page at ${relative(root, out)}/index.html; build first`);

const version = `v${config.version.replace(/^v/, "")}`;
const title = `${config.name} ${version}`;
const top = config.folder ?? ".handoff";
const folder = `${top}/${config.slug}`;
const alias = config.source?.alias ?? { "@/": "src/" };
const skip = config.source?.skip ?? /$^/;
const screens = Object.entries(config.screens);

const git = (args: string) =>
  execSync(`git ${args}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).toString();

const sha = (() => {
  if (process.env.HANDOFF_SHA) return process.env.HANDOFF_SHA;
  try {
    return git("rev-parse HEAD").trim();
  } catch {
    return fail("outside git, give the commit as HANDOFF_SHA");
  }
})();
const short = sha.slice(0, 7);

/* ── The source a brief can name ──────────────────────────────────────────── */

const IMPORT = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;
const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", ".css", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
const fromRoot = (p: string) => relative(root, p);

function find(spec: string, from: string) {
  const bare = spec.replace(/\?.*$/, "");
  let start: string | null = null;
  if (bare.startsWith(".")) start = resolve(root, dirname(from), bare);
  else
    for (const [prefix, to] of Object.entries(alias))
      if (bare.startsWith(prefix)) {
        start = resolve(root, to, bare.slice(prefix.length));
        break;
      }
  if (!start) return null;
  for (const ext of EXTS) if (isFile(start + ext)) return fromRoot(start + ext);
  return null;
}

function importsOf(file: string): string[] {
  if (!/\.(tsx?|jsx?|css)$/.test(file) || !isFile(resolve(root, file))) return [];
  const found = new Set<string>();
  for (const m of readFileSync(resolve(root, file), "utf8").matchAll(IMPORT)) {
    const hit = find(m[1] ?? m[2] ?? m[3], file);
    if (hit) found.add(hit);
  }
  return [...found];
}

const walk = (p: string): string[] => {
  const full = resolve(root, p);
  if (!existsSync(full)) return fail(`${p} does not exist`);
  if (statSync(full).isFile()) return [p];
  return readdirSync(full).flatMap((n) => walk(join(p, n)));
};

for (const [key, s] of screens)
  for (const f of s.files) if (!isFile(resolve(root, f))) fail(`${key} names ${f}, which does not exist`);

function sourceFiles() {
  const roots = (config.source?.roots ?? [...screens.flatMap(([, s]) => s.files), ...(config.shared ?? [])]).flatMap(walk);
  const keep = new Set<string>();
  const todo = [...roots];
  while (todo.length) {
    const f = todo.pop()!;
    if (keep.has(f) || skip.test(f) || f.endsWith(".DS_Store")) continue;
    keep.add(f);
    if (config.source?.follow !== false) todo.push(...importsOf(f));
  }
  return keep;
}

/* The pack says which commit it is, so everything in it has to be that commit. */
function checkClean(files: string[]) {
  if (process.env.HANDOFF_SHA || argv.includes("--dirty")) return;
  const dirty = git(`status --porcelain -- ${files.map((f) => JSON.stringify(f)).join(" ")}`).trim();
  if (dirty) fail(`commit these first, the pack is built from a commit (or pass --dirty to try it):\n${dirty}`);
}

/* ── The notes, section by section ────────────────────────────────────────── */

const notes = readFileSync(resolve(root, config.notes), "utf8").replace(/<!--[\s\S]*?-->\n*/g, "");

function required(id: string) {
  const s = sectionOf(notes, id) ?? fail(`${config.notes} has no section ${id}`);
  return { ...s, body: s.body.replace(/\]\(#/g, "](notes.md#") };
}

/* ── The built page, served where it expects to be ───────────────────────── */

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

function serve(): Promise<{ origin: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const inside = path.startsWith(base) ? path.slice(base.length) : "";
    let file = join(dist, inside);
    if (file.startsWith(dist) && existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    const hit = inside && file.startsWith(dist) && isFile(file) ? file : join(out, "index.html");
    res.setHeader("Content-Type", TYPES[extname(hit)] ?? "application/octet-stream");
    res.end(readFileSync(hit));
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () => {
      const at = server.address();
      if (at && typeof at === "object") done({ origin: `http://127.0.0.1:${at.port}`, close: () => server.close() });
    }),
  );
}

/* ── A picture of every state ─────────────────────────────────────────────── */

type State = { key: string; label: string; query: string; href: string; shot?: string };

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "state";
const states: State[] = [];
for (const [key, s] of screens) {
  const taken = new Set<string>();
  for (const st of s.states) {
    let name = slugOf(st.label);
    for (let n = 2; taken.has(name); n++) name = `${slugOf(st.label)}-${n}`;
    taken.add(name);
    states.push({ key, label: st.label, query: st.query, href: new URL(st.query, address).href, shot: `shots/${fileName(key)}/${name}.jpg` });
  }
}

/** Every key the state's query sets is set the same way in the other. */
const sameState = (query: string, other: string) => {
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(other);
  return [...want].every(([k, v]) => have.get(k) === v) && [...have].every(([k, v]) => want.get(k) === v);
};

function findChrome() {
  if (process.env.HANDOFF_CHROME) return process.env.HANDOFF_CHROME;
  const cached = (dir: string) => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .flatMap((build) =>
        readdirSync(join(dir, build)).map((inner) => join(dir, build, inner, "chrome-headless-shell")),
      );
  };
  const candidates = [
    ...cached(resolve(root, "chrome-headless-shell")),
    ...cached(join(homedir(), ".cache/puppeteer/chrome-headless-shell")),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return (
    candidates.find(isFile) ??
    fail("no Chrome to draw the pictures with. Set HANDOFF_CHROME, run `npx @puppeteer/browsers install chrome-headless-shell@stable`, or pass --no-shots")
  );
}

const DRAWERS = 4;
const LIMIT = 45_000;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function drawStates(home: string) {
  let puppeteer: typeof import("puppeteer-core");
  try {
    puppeteer = await import("puppeteer-core");
  } catch {
    return fail("pictures need puppeteer-core: npm i -D puppeteer-core, or pass --no-shots");
  }
  const { origin, close } = await serve();
  const width = config.shots?.width ?? 1440;
  const height = config.shots?.height ?? 900;
  const browser = await puppeteer.default.launch({
    executablePath: findChrome(),
    headless: true,
    pipe: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb"],
    defaultViewport: { width, height },
  });
  try {
    const todo = [...states];
    let done = 0;
    const worker = async () => {
      const tab = await browser.newPage();
      for (let s = todo.shift(); s; s = todo.shift()) {
        const state = s;
        const stuck = setTimeout(() => fail(`${state.query} did not draw in ${LIMIT / 1000}s`), LIMIT);
        await tab.goto(`${origin}${page}${state.query}`, { waitUntil: "load" });
        await tab.evaluate("document.fonts.ready.then(() => 0)");
        const slow = config.shots?.slow;
        await pause(slow?.query.test(state.query) ? slow.wait : (config.shots?.wait ?? 1500));
        // The bar is cropped off rather than hidden, so the page does not reflow.
        const top = Number(
          await tab.evaluate('document.querySelector("header[data-proto-chrome]")?.getBoundingClientRect().bottom ?? 0'),
        );
        const file = join(home, state.shot!);
        mkdirSync(dirname(file), { recursive: true });
        await tab.screenshot({
          path: file as `${string}.jpeg`,
          type: "jpeg",
          quality: 72,
          clip: { x: 0, y: top, width, height: height - top },
        });
        clearTimeout(stuck);
        process.stdout.write(`\r  ${++done} of ${states.length} drawn`);
      }
      await tab.close();
    };
    await Promise.all(Array.from({ length: Math.min(DRAWERS, states.length) }, worker));
    if (done) process.stdout.write("\n");
  } finally {
    await browser.close();
    close();
  }
}

/* ── The files ────────────────────────────────────────────────────────────── */

const getPack = `mkdir -p ${top} && curl -fsSL ${address}pack.zip -o ${top}/pack.zip && unzip -oq ${top}/pack.zip -d ${top}`;

function agentsFile() {
  const lines = [
    `# Handoff: ${title}`,
    "",
    "The design as it ships, with every decision closed.",
    "",
    `- Built from commit \`${short}\`${config.repo ? ` of ${config.repo}` : ""}, the same one as the live prototype.`,
    `- Live prototype: ${address}`,
    "",
    "## How to work from this folder",
    "",
    ...(config.product
      ? ["0. Before your first screen, read `PRODUCT.md`: where this goes in the product, what to set up first, and how its parts fit beside the product's. Do its setup once."]
      : []),
    "1. Read this file, then the one brief under `screens/` you were sent to.",
    "2. Read every file that brief lists before you start.",
    "3. Open anything else in `source/` only when one of those files cannot be understood without it. It is the reference, not the task. Never read it as a whole.",
    "4. Port the behaviour and the look into the repo you are working in, with its own structure, conventions, data and names. These notes cover only what the prototype cannot show.",
    "5. Check the result against the pictures in `shots/`, which a brief links state by state. Where a picture and the source disagree, the source wins.",
    "",
    "## Screens",
    "",
    "| Screen | Brief |",
    "| --- | --- |",
    ...screens.map(([key, s]) => `| ${s.title} | \`screens/${fileName(key)}.md\` |`),
    "",
  ];
  if (config.everywhere?.length) {
    lines.push("## Decisions that hold everywhere", "");
    for (const id of config.everywhere) {
      const s = required(id);
      if (config.everywhere.length > 1) lines.push(`### ${s.title}`, "");
      lines.push(s.body, "");
    }
  }
  if (config.fakes) lines.push("## What the prototype fakes", "", required(config.fakes).body, "");
  lines.push(
    "## Also in this folder",
    "",
    "- `notes.md`: the implementation notes whole. A brief already carries its screen's part.",
    "- `changes.md`: what changed since the handoff, newest first. `changes/` holds a brief per change, for applying one to work already built.",
    "- `VERSION`: the version and the commit this pack was built from.",
    "",
  );
  return lines.join("\n");
}

/** What a screen's files import that the pack has, the most used first. */
function reachOf(key: string, inPack: Set<string>) {
  const named = config.screens[key].files;
  const near = new Map<string, number>();
  for (const f of named)
    for (const hit of importsOf(f)) if (!named.includes(hit) && inPack.has(hit)) near.set(hit, (near.get(hit) ?? 0) + 1);
  return [...near].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([f]) => f);
}

function briefFile(key: string, inPack: Set<string>) {
  const s = config.screens[key];
  const lines = [`# ${s.title} (\`${key}\`)`, ""];
  const mine = states.filter((st) => st.key === key);
  if (mine.length) {
    lines.push("## See it", "", "| State | Open it | Picture |", "| --- | --- | --- |");
    for (const st of mine) {
      const shot = st.shot && existsSync(join(home, st.shot)) ? `[${st.shot.split("/").pop()}](../${st.shot})` : "none";
      lines.push(`| ${st.label} | ${st.href} | ${shot} |`);
    }
    lines.push("");
  }
  lines.push(
    "## Read these before you start",
    "",
    "Read all of them. The rules below say what must be true; these say how the screen behaves moment to moment, and they are the source of truth for its look and the order of events.",
    "",
    ...s.files.map((f) => `- \`source/${f}\``),
    "",
  );
  const reach = reachOf(key, inPack);
  if (reach.length) lines.push("## What they import", "", "Open one of these only if you need it.", "", ...reach.map((f) => `- \`source/${f}\``), "");
  if (s.notes?.length) {
    lines.push("## Rules", "", "`AGENTS.md` holds the decisions that hold everywhere. These are this screen's own.", "");
    for (const id of s.notes) {
      const sec = required(id);
      lines.push(`### ${sec.title}`, "", sec.body.replace(/\]\(notes\.md#/g, "](../notes.md#"), "");
    }
  }
  return lines.join("\n");
}

function llms() {
  return [
    `# ${title}`,
    "",
    `> A handoff to engineering: the design as it ships. This page needs JavaScript to draw, so an agent cannot read it. Everything an agent needs is in the pack below, built from commit ${short}.`,
    "",
    "Get the pack, from the root of the repo you are working in:",
    "",
    "```bash",
    getPack,
    "```",
    "",
    `Then read \`${folder}/AGENTS.md\`${config.product ? `, \`${folder}/PRODUCT.md\` before your first screen` : ""}, and the brief for your screen under \`${folder}/screens/\`. Do not read \`source/\` as a whole. The folder keeps itself out of git. If you cannot reach the network, ask the developer to use Code › The whole pack on the handoff.`,
    "",
    "## Pack",
    "",
    `- [pack.zip](${address}pack.zip): how to work, a brief per screen, a picture per state, and the source`,
    "",
    "## Screens",
    "",
    ...screens.map(([key, s]) => `- ${s.title}: \`screens/${fileName(key)}.md\``),
    "",
  ].join("\n");
}

/* ── A brief per change ───────────────────────────────────────────────────── */

/* Over this a diff is more than a brief should hand an agent. */
const DIFF_LIMIT = 1500;

function changeBriefs(home: string, files: Set<string>) {
  const dir = join(home, "changes");
  mkdirSync(dir, { recursive: true });
  const entries = parseChanges(readFileSync(resolve(root, config.changes), "utf8")).flatMap((g) => g.changes);
  const commitOf = new Map<string, string>();
  for (const c of entries) {
    try {
      const found = git(`log --format=%H -S${JSON.stringify(`{#${c.id}}`)} ${sha} -- ${JSON.stringify(config.changes)}`)
        .trim()
        .split("\n")
        .filter(Boolean);
      if (found.length) commitOf.set(c.id, found[found.length - 1]);
    } catch {
      // Outside git there is no history: the brief goes without its files.
    }
  }
  for (const c of entries) {
    const commit = commitOf.get(c.id);
    const touched = commit
      ? git(`show --format= --name-only ${commit}`).trim().split("\n").filter((f) => files.has(f))
      : [];
    const hit = screens.filter(([, s]) => s.files.some((f) => touched.includes(f))).map(([key, s]) => `- ${s.title}: \`screens/${fileName(key)}.md\``);
    const state = c.opens ? states.find((st) => sameState(st.query, c.opens!)) : undefined;
    const lines = [`# ${c.title}`, "", `Changed ${c.date}.`, ""];
    if (c.body) lines.push(c.body, "");
    if (c.impact) lines.push(`**Impact:** ${c.impact}`, "");
    if (c.opens) lines.push(`See it: ${state?.href ?? new URL(c.opens, address).href}`, "");
    if (state?.shot && existsSync(join(home, state.shot))) lines.push(`Picture: \`${state.shot}\``, "");
    if (!touched.length) {
      lines.push(commit ? "This changed nothing in the design's source. There may be nothing to build." : "Its commit was not found, so its files are not listed.", "");
      writeFileSync(join(dir, `${c.id}.md`), lines.join("\n"));
      continue;
    }
    if (hit.length) lines.push("## Screens it touched", "", ...hit, "");
    lines.push("## Files it touched", "", "As they stand now, under `source/`.", "", ...touched.map((f) => `- \`source/${f}\``), "");
    const diff = git(`show --format= ${commit} -- ${touched.map((f) => JSON.stringify(f)).join(" ")}`);
    if (diff.split("\n").length <= DIFF_LIMIT) {
      writeFileSync(join(dir, `${c.id}.diff`), diff);
      lines.push("## The diff", "", `\`changes/${c.id}.diff\` is the change as it was made.`, "");
    } else lines.push("## The diff", "", "This came with too much else for a diff to help. Read the files above for what this entry describes.", "");
    const shared = entries.filter((e) => e.id !== c.id && commitOf.get(e.id) === commit);
    if (shared.length) lines.push(`It went over in one commit with: ${shared.map((e) => e.title).join("; ")}. Take only what this entry describes.`, "");
    writeFileSync(join(dir, `${c.id}.md`), lines.join("\n"));
  }
}

/* The line an agent meets if it fetches the page itself. Inside the root, so
   the app replaces it as it starts and a person never sees it. */
function pointAtPack() {
  const file = join(out, "index.html");
  const html = readFileSync(file, "utf8");
  if (html.includes("llms.txt")) return;
  const line = `For coding agents: this page needs JavaScript. Read ${address}llms.txt instead.`;
  const next = html
    .replace("</head>", `  <meta name="description" content="${line}" />\n    <link rel="alternate" type="text/markdown" href="${page}llms.txt" />\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><p hidden>${line}</p></div>`);
  if (!next.includes("<p hidden>")) fail("could not find <div id=\"root\"></div> in the built page");
  writeFileSync(file, next);
}

/* A pack is public wherever the page is, so a secret stops the build. */
const SECRET = /\b(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

/* Fixed dates, so a zip of the same files is the same bytes. */
function zipUp(cwd: string, to: string, what: string[]) {
  rmSync(to, { force: true });
  const list = what.map((w) => JSON.stringify(w)).join(" ");
  execSync(`find ${list} -exec touch -t 202601010000 {} +`, { cwd });
  execSync(`zip -qrX ${JSON.stringify(to)} ${list}`, { cwd });
}

/* The pieces the Code menu's Download list hands over, each in the same folders
   as the pack, so one screen's bundle unpacks where the agent's prompt looks. */
function pieces(stage: string, files: Set<string>) {
  const to = join(out, "pack");
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  const home = join(stage, config.slug);
  cpSync(join(home, "notes.md"), join(to, `${config.slug}-notes.md`));
  for (const [key, s] of screens) {
    const name = `${config.slug}-${fileName(key)}`;
    const brief = `screens/${fileName(key)}.md`;
    const shots = `shots/${fileName(key)}`;
    cpSync(join(home, brief), join(to, `${name}.md`));
    if (existsSync(join(home, shots))) zipUp(home, join(to, `${name}-pictures.zip`), [shots]);
    const dir = mkdtempSync(join(tmpdir(), "handoff-piece-"));
    const take = (f: string) => {
      if (existsSync(join(home, f))) cpSync(join(home, f), join(dir, config.slug, f), { recursive: true });
    };
    for (const f of ["AGENTS.md", "CLAUDE.md", "VERSION", "PRODUCT.md", "notes.md", brief, shots]) take(f);
    for (const f of [...s.files, ...reachOf(key, files)]) take(`source/${f}`);
    cpSync(join(stage, ".gitignore"), join(dir, ".gitignore"));
    zipUp(dir, join(to, `${name}.zip`), [".gitignore", config.slug]);
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ── The build ────────────────────────────────────────────────────────────── */

const files = sourceFiles();
const assets = (config.source?.assets ?? []).flatMap(walk);
checkClean([...files, ...assets, config.notes, config.changes, ...(config.product ? [config.product] : []), fromRoot(configPath)]);

const stage = mkdtempSync(join(tmpdir(), "handoff-pack-"));
const home = join(stage, config.slug);
mkdirSync(join(home, "screens"), { recursive: true });

try {
  console.log(`pack: ${title} at ${short}`);
  for (const [, s] of screens) for (const n of s.notes ?? []) required(n);
  for (const f of [...files, ...assets]) {
    if (SECRET.test(readFileSync(resolve(root, f), "latin1"))) fail(`${f} looks like it holds a secret`);
    const to = join(home, "source", f);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(resolve(root, f), to);
  }
  if (argv.includes("--no-shots")) console.log("pack: no pictures (--no-shots)");
  else await drawStates(home);

  for (const [key] of screens) writeFileSync(join(home, "screens", `${fileName(key)}.md`), briefFile(key, files));
  writeFileSync(join(home, "AGENTS.md"), agentsFile());
  writeFileSync(join(home, "CLAUDE.md"), "@AGENTS.md\n");
  writeFileSync(join(home, "VERSION"), `${version} ${short}\n`);
  if (config.product) cpSync(resolve(root, config.product), join(home, "PRODUCT.md"));
  writeFileSync(join(home, "notes.md"), notes);
  writeFileSync(join(home, "changes.md"), readFileSync(resolve(root, config.changes), "utf8").replace(/<!--[\s\S]*?-->\n*/g, ""));
  writeFileSync(join(stage, ".gitignore"), "*\n");

  changeBriefs(home, files);
  pieces(stage, files);
  const zip = join(out, "pack.zip");
  zipUp(stage, zip, [".gitignore", config.slug]);
  writeFileSync(join(out, "llms.txt"), llms());
  pointAtPack();
  if (flag("--keep")) cpSync(stage, resolve(flag("--keep")!), { recursive: true });
  const mb = (statSync(zip).size / 1e6).toFixed(2);
  console.log(`pack: ${states.length} states, ${screens.length} briefs, ${files.size} source files, ${mb} MB → ${relative(root, out) || "."}/pack.zip`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
