// ─── What a handoff is ────────────────────────────────────────────────────────
//
// One file per project, `handoff.config.ts` at its root, says everything the
// handoff needs to know: its name and version, where it is deployed, which repo
// its files open in, and for every screen the files that draw it, the sections
// of the notes it carries and the addresses of its states.
//
// Three things read it and nothing is written twice:
//   · `vite-handoff.ts` hands it to the bar, as `virtual:handoff`;
//   · the bar's States sheet lists the states from it;
//   · `handoff-pack.mts` draws a picture of every state and writes a brief per
//     screen from it.
//
// Plain data and pure functions only: node reads this file as well as the
// browser, so it imports nothing.

/** One state of a screen: what to call it and the address that opens it. */
export interface HandoffState {
  label: string;
  /** The query string that opens it, from the handoff page: `?screen=orders&state=empty`. */
  query: string;
  /** One line on what it is, where the label does not say. */
  note?: string;
}

export interface HandoffScreen {
  title: string;
  /** The files that draw it, repo-relative, the most its own first. Every one
   *  must exist, or the build stops. */
  files: string[];
  /** Ids of sections in the notes file this screen's brief carries as its rules. */
  notes?: string[];
  states: HandoffState[];
}

export interface HandoffConfig {
  /** What the bar and every brief call it: "Checkout". */
  name: string;
  /** Short and file-safe: the pack's folder and every download's name. */
  slug: string;
  /** "1.2". Bump it when a round goes to the developers; CHANGES.md groups by it. */
  version: string;
  /** The deployed handoff page, a full URL. The pack sits beside it. */
  address: string;
  /** `owner/name` on GitHub, where every file in the Code menu opens. Leave it
   *  out when the source must not be on GitHub: the pack carries it, and the
   *  Code menu's files copy their path instead of opening. */
  repo?: string;
  /** Where the pack unpacks in the developer's repo. Default `.handoff`. */
  folder?: string;
  /** The page sits behind a password, so an agent cannot fetch the pack: the
   *  prompts send the developer to Code › The whole pack instead of `curl`. */
  private?: boolean;
  /** The implementation notes: markdown, one `## Title {#id}` section per rule. */
  notes: string;
  /** What changed since it was handed over (see the comment in the demo's file). */
  changes: string;
  /** Where it goes in the product, what to set up first. Optional. */
  product?: string;
  /** Note sections that hold for every screen, written into AGENTS.md. */
  everywhere?: string[];
  /** The note section that says what the prototype fakes. */
  fakes?: string;
  /** Files every screen leans on, listed once under Shared. */
  shared?: string[];
  /** What the pack's `source/` holds. */
  source?: {
    /** Where to start. Default: every screen's files and the shared ones. */
    roots?: string[];
    /** Follow their imports. Default true. */
    follow?: boolean;
    /** What never goes in: the bar, the prototype's fake data, its own pages. */
    skip?: RegExp;
    /** Import aliases, prefix → folder. Default `{ "@/": "src/" }`. */
    alias?: Record<string, string>;
    /** Copied as they are: images the source points at, `package.json`. */
    assets?: string[];
  };
  /** How the pictures are taken. */
  shots?: {
    width?: number;
    height?: number;
    /** How long a state gets to settle, in ms. Default 1500. */
    wait?: number;
    /** States that take longer, by their query. */
    slow?: { query: RegExp; wait: number };
  };
  screens: Record<string, HandoffScreen>;
}

export const defineHandoff = (config: HandoffConfig) => config;

/** One entry on the Changes page. */
export interface Change {
  id: string;
  title: string;
  /** `2026-11-18` or `2026-11-18 14:05`. */
  date: string;
  /** Where "Open it" goes: a query, `?screen=orders`. */
  opens?: string;
  /** What it means for whoever builds it. */
  impact?: string;
  body: string;
}

export interface ChangeGroup {
  version: string;
  changes: Change[];
}

/** What the bar is handed, as `virtual:handoff`. */
export interface HandoffData {
  name: string;
  slug: string;
  version: string;
  address: string;
  /** The handoff page's path, `/checkout/`, for links that stay on the host it is opened on. */
  page: string;
  repo?: string;
  /** The commit the page was built from, or `main` outside git. */
  sha: string;
  folder: string;
  /** Behind a password: the pack is downloaded by hand, never fetched. */
  private: boolean;
  /** False on the dev server, where the pack has not been written. */
  built: boolean;
  product: boolean;
  shared: string[];
  screens: Record<string, { title: string; files: string[]; notes: string[]; states: HandoffState[] }>;
  /** The notes as HTML, each section's heading carrying its id. */
  notesHtml: string;
  changes: { version: string; changes: RenderedChange[] }[];
}

/** A change with its body and impact as HTML, for the Changes page. */
export interface RenderedChange extends Change {
  html: string;
  impactHtml: string;
}

/** The changes file as groups, in the order it is written. Comments are skipped,
 *  so the file can carry its own instructions. */
export function parseChanges(text: string): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  const src = text.replace(/<!--[\s\S]*?-->/g, "");
  for (const part of src.split(/^## /m).slice(1)) {
    const [head, ...entries] = part.split(/^### /m);
    const group: ChangeGroup = { version: head.trim().replace(/^v/, ""), changes: [] };
    for (const entry of entries) {
      const [first, ...lines] = entry.split("\n");
      const named = first.match(/^(.*?)\s*\{#([\w-]+)\}\s*$/);
      if (!named) continue;
      const field = (name: string) =>
        lines.find((l) => l.startsWith(`- **${name}**`))?.slice(`- **${name}**`.length).trim();
      const body = lines
        .filter((l) => !/^- \*\*(Date|Opens|Impact)\*\*/.test(l))
        .join("\n")
        .trim();
      group.changes.push({
        id: named[2],
        title: named[1],
        date: field("Date") ?? "",
        opens: field("Opens"),
        impact: field("Impact"),
        body,
      });
    }
    groups.push(group);
  }
  return groups;
}

/** One section of the notes: a heading that names its id (`## Title {#id}`) or
 *  is one (`## id`), down to the next heading of its level. */
export function sectionOf(notes: string, id: string): { title: string; body: string } | null {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const head = new RegExp(`^(#{2,3}) (?:(.*?) \\{#${esc}\\}|${esc})[ \\t]*$`, "m").exec(notes);
  if (!head) return null;
  const rest = notes.slice(head.index + head[0].length);
  // It ends at the next heading of its level or above, or at any heading with
  // an id of its own: that one is its own section, carried by name.
  const end = rest.search(new RegExp(`^(?:#{1,${head[1].length}} |#{2,6} .*\\{#[\\w-]+\\}[ \\t]*$)`, "m"));
  return { title: head[2] ?? id, body: (end < 0 ? rest : rest.slice(0, end)).trim() };
}

/** Every section id the notes define. */
export function sectionIds(notes: string): string[] {
  return [...notes.matchAll(/^#{2,3} .*?\{#([\w-]+)\}[ \t]*$/gm)].map((m) => m[1]);
}

/** A key as a file name. */
export const fileName = (key: string) => key.replace(/[^a-z0-9-]+/gi, "-");

/** The address with exactly one slash on the end, so `pack.zip` goes beside the page. */
export const dirOf = (address: string) => (address.endsWith("/") ? address : `${address}/`);
