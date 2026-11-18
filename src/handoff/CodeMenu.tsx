// ─── The Code menu ────────────────────────────────────────────────────────────
//
// What a developer needs, in the order they need it. First a prompt for their
// coding agent about the screen on the page; then the same pieces by hand; then
// the files the screen is made from and the ones every screen leans on, each
// opening on GitHub at the commit the page was built from; the whole repo last,
// because an agent sent there reads all of it.
//
// A handoff with no `repo` keeps its source off GitHub: the pack is the only
// copy. Then a file row copies its path, which is where it sits under the
// pack's `source/`, and there is no repo row.
//
// One panel rather than submenus, so it works the same on a phone. Downloads
// exist only on the built site, where the pack was written; on the dev server
// they say so instead of linking to nothing.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { chrome } from "../chrome";
import { Chevron, PHONE_PANEL, trigger } from "../parts";
import { copyText, downloads, handoff, onGitHub, promptForScreen, repoHome, short } from "./prompts";

const row =
  "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-start text-[12px] text-ui-text no-underline transition-colors hover:bg-ui-raised focus-visible:bg-ui-raised focus-visible:outline-none";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col border-t border-ui-line/70 pt-1.5 first:border-0 first:pt-0">
      <span className="px-2 pt-1 pb-1 text-[10px] font-medium tracking-wide text-ui-dim uppercase">{title}</span>
      {children}
    </div>
  );
}

/** A file: the row opens it on GitHub, the button beside it copies its path.
 *  With no repo to open it in, the whole row copies the path. */
function FileRow({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const href = onGitHub(path);
  async function copy() {
    if (await copyText(path)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }
  if (!href) {
    return (
      <button type="button" onClick={copy} aria-label={`Copy ${path}`} className={`${row} group font-mono text-[11px]`}>
        <span className="flex-1 truncate">{path}</span>
        <span className="shrink-0 font-sans text-[10px] text-ui-dim">{copied ? "Copied" : "Copy"}</span>
      </button>
    );
  }
  return (
    <div className="group flex items-center">
      <a href={href} target="_blank" rel="noreferrer" className={`${row} font-mono text-[11px]`} title={`Open ${path} on GitHub`}>
        <span className="truncate">{path}</span>
      </a>
      <button
        type="button"
        onClick={copy}
        title="Copy the path"
        aria-label={`Copy ${path}`}
        className="shrink-0 cursor-pointer rounded-md px-1.5 py-1 text-[10px] text-ui-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-ui-text focus-visible:opacity-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CodeMenu({ screen }: {
  /** The key in `handoff.config.ts` of the screen on the page. */
  screen?: string;
}) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const here = screen ? handoff.screens[screen] : undefined;
  const own = here?.files ?? [];
  const shared = handoff.shared.filter((p) => !own.includes(p));

  async function copyPrompt() {
    const ok = await copyText(promptForScreen(here ? screen : undefined));
    setSaid(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSaid(null);
      if (ok) setOpen(false);
    }, ok ? 900 : 2400);
  }

  return (
    <div ref={box} {...chrome} className="relative flex shrink-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`${trigger} ${open ? "bg-ui-raised" : ""}`}>
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ui-dim" fill="none" aria-hidden>
          <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Code
        <Chevron />
      </button>

      {open ? (
        <div
          className={`absolute end-0 top-full z-[70] mt-1.5 flex max-h-[70vh] w-[380px] flex-col gap-1.5 overflow-auto rounded-lg border border-ui-line bg-ui-surface p-1.5 shadow-2xl max-sm:max-h-[calc(100dvh-64px)] ${PHONE_PANEL}`}
        >
          <Group title="For your agent">
            <button type="button" onClick={copyPrompt} className={row}>
              <span className="flex-1">{said === "copied" ? "Copied" : said === "failed" ? "Couldn’t copy" : "Copy for your agent"}</span>
              <span className="text-[11px] text-ui-dim">{here ? here.title : "The whole handoff"}</span>
            </button>
          </Group>

          <Group title="Download">
            {handoff.built ? (
              downloads(here ? screen : undefined).map((d) => (
                <a key={d.href} href={d.href} download={d.name} className={row}>
                  {d.label}
                </a>
              ))
            ) : (
              <p className="m-0 px-2 py-1.5 text-[11px] leading-4 text-ui-dim">
                Written beside the built page by <code className="font-mono">handoff-pack.mts</code>. Nothing to download on the dev server.
              </p>
            )}
          </Group>

          {own.length ? (
            <Group title={`${here!.title} · ${own.length} file${own.length === 1 ? "" : "s"}`}>
              {own.map((p) => (
                <FileRow key={p} path={p} />
              ))}
            </Group>
          ) : null}

          {shared.length ? (
            <Group title={`Shared · ${shared.length}`}>
              {shared.map((p) => (
                <FileRow key={p} path={p} />
              ))}
            </Group>
          ) : null}

          {repoHome() ? (
            <Group title="Repo">
              <a href={repoHome()} target="_blank" rel="noreferrer" className={row}>
                <span className="flex-1">Whole repo on GitHub</span>
                <span className="font-mono text-[11px] text-ui-dim">{short}</span>
              </a>
            </Group>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
