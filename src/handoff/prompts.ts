// ─── What the bar hands a developer's agent ───────────────────────────────────
//
// The prompts behind Copy for your agent, and the links behind Download. Both
// point at the same pack `handoff-pack.mts` writes beside the page, so a prompt
// and a download land the same files in the same folder.
//
// The order to read things is in the prompt as well as in the pack's AGENTS.md:
// an agent told it only inside the pack skipped it.

import handoff from "virtual:handoff";
import { fileName } from "./config";

export { handoff };

export const short = handoff.sha.slice(0, 7);
export const version = `v${handoff.version}`;
const folder = `${handoff.folder}/${handoff.slug}`;

/** A file in the repo, at the commit the page was built from — or nothing, when
 *  the handoff names no repo and the pack is the only copy of the source. */
export const onGitHub = (path: string) =>
  handoff.repo ? `https://github.com/${handoff.repo}/blob/${handoff.sha}/${path}` : undefined;
export const repoHome = () => (handoff.repo ? `https://github.com/${handoff.repo}/tree/${handoff.sha}` : undefined);

/** A state's address on whatever host the page is open on. */
export const pageHref = (query = "") => `${handoff.page}${query}`;

// A handoff behind a password (`private`) has a pack an agent cannot fetch, so
// the developer downloads it once by hand.
const getThePack = handoff.private
  ? [
      `1. If ${folder}/VERSION does not mention ${short}, stop and ask me to get the pack: on the handoff page (${handoff.address}), Code › The whole pack, unzipped into ${handoff.folder}/ at the root of this repo.`,
      "   The page is behind a password, so do not try to download it yourself.",
    ]
  : [
      `1. If ${folder}/VERSION does not mention ${short}, get the pack from the root of this repo:`,
      `   mkdir -p ${handoff.folder} && curl -fsSL ${handoff.address}pack.zip -o ${handoff.folder}/pack.zip && unzip -oq ${handoff.folder}/pack.zip -d ${handoff.folder}`,
      `   If you cannot reach the network, stop and ask me to use Code › The whole pack on the handoff and unzip it into ${handoff.folder}/.`,
    ];

/** For the screen on the page, or for the handoff as a whole. */
export function promptForScreen(key?: string) {
  const screen = key ? handoff.screens[key] : undefined;
  const reads = [`${folder}/AGENTS.md`];
  if (handoff.product) reads.push(`${folder}/PRODUCT.md, which says where this goes in this repo and what to set up first`);
  if (screen) reads.push(`${folder}/screens/${fileName(key!)}.md`);
  return [
    `Handoff: ${handoff.name} ${version} (${short}).`,
    screen ? `We are building: ${screen.title}.` : "We are building from this handoff.",
    "",
    ...getThePack,
    `2. Read ${reads.join(", then ")}${screen ? "" : ", and ask me which screen we are building"}.`,
    "3. Read every file the brief lists before you start. Open nothing else in that folder unless one of those files cannot be understood without it.",
    "4. Build it in this repo, in this repo's own structure and conventions. Tell me your plan first.",
  ].join("\n");
}

/** For one entry on the Changes page: that change to work already built. */
export function promptForChange(id: string, title: string) {
  return [
    `Handoff: ${handoff.name} ${version} (${short}).`,
    `One change to work already built: "${title}".`,
    "",
    ...getThePack,
    `2. Read ${folder}/changes/${id}.md. It says what changed, what it means for the build, and the files it touched.`,
    "3. Find where this already lives in this repo and change only that. Do not rebuild the screen. Open nothing else in that folder unless that brief sends you there.",
    "4. If it is not built here yet, tell me rather than building it from this change. Tell me your plan first.",
  ].join("\n");
}

export interface Download {
  label: string;
  href: string;
  name: string;
}

/** What can be taken by hand: the screen on the page, then everything. */
export function downloads(key?: string): Download[] {
  const { slug } = handoff;
  const piece = (end: string) => pageHref(`pack/${slug}-${end}`);
  const name = key && handoff.screens[key] ? fileName(key) : undefined;
  return [
    ...(name
      ? [
          { label: "This screen, everything", href: piece(`${name}.zip`), name: `${slug}-${name}.zip` },
          { label: "Its brief", href: piece(`${name}.md`), name: `${slug}-${name}.md` },
          { label: "Its pictures", href: piece(`${name}-pictures.zip`), name: `${slug}-${name}-pictures.zip` },
        ]
      : []),
    { label: "The whole pack", href: pageHref("pack.zip"), name: `${slug}-pack.zip` },
    { label: "All the notes", href: piece("notes.md"), name: `${slug}-notes.md` },
  ];
}

/** The clipboard, with the old way for a page that is not allowed the new one
 *  (an iframe, plain http). Says whether it took. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
