// ─── What the sheet shows ─────────────────────────────────────────────────────
//
// Three pages, all read from `virtual:handoff`, so none can disagree with the
// pack: every state by its screen, the implementation notes, and what changed
// since the handoff went out.

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { copyText, handoff, pageHref, promptForChange } from "./prompts";

/** Markdown from the notes and changes, in the sheet's own type. */
export const PROSE =
  "text-[13px] leading-5 [&_a]:text-ui-text [&_a]:underline [&_a]:decoration-ui-line [&_a]:underline-offset-2 [&_a:hover]:decoration-ui-dim [&_code]:rounded [&_code]:bg-ui-raised [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[12px] [&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:text-[16px] [&_h1]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-6 [&_h2]:border-b [&_h2]:border-ui-line [&_h2]:pb-2 [&_h2]:text-[14px] [&_h2]:font-medium [&_h2:first-child]:mt-0 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:scroll-mt-6 [&_h3]:text-[13px] [&_h3]:font-medium [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-ui-bg [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-medium [&_table]:my-3 [&_table]:w-full [&_table]:text-[12px] [&_td]:border-b [&_td]:border-ui-line [&_td]:py-1.5 [&_td]:pe-3 [&_th]:border-b [&_th]:border-ui-line [&_th]:py-1.5 [&_th]:pe-3 [&_th]:text-start [&_th]:font-medium [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-5";

/** A plain left-click on a link to a state, followed in place. */
function followed(e: MouseEvent, query: string, open: (query: string) => void) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  open(query);
}

// ─── States ───────────────────────────────────────────────────────────────────

/** Every state, by its screen. The one on the page is marked and scrolled to. */
export function StatesList({ current, open }: { current: string; open: (query: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);
  return (
    <div ref={list} className="flex flex-col gap-10">
      {Object.entries(handoff.screens).map(([key, screen]) => (
        <section key={key} className="flex flex-col gap-2">
          <h3 className="m-0 border-b border-ui-line pb-2 text-[13px] leading-[18px] font-medium">{screen.title}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {screen.states.map((s) => {
              const on = sameState(s.query, current);
              return (
                <li key={s.query}>
                  <a
                    href={pageHref(s.query)}
                    aria-current={on ? "page" : undefined}
                    onClick={(e) => followed(e, s.query, open)}
                    className={`-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-2 no-underline transition-colors ${
                      on ? "bg-ui-raised" : "hover:bg-ui-raised/60"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[13px] leading-[18px] text-ui-text">
                      {s.label}
                      {on ? <span className="text-[11px] text-ui-dim">Showing</span> : null}
                    </span>
                    {s.note ? <span className="text-[12px] leading-4 text-ui-dim">{s.note}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Two queries name the same state when every key one sets the other sets the
 *  same way; anything else in the address (notes on, a tracking tag) is ignored. */
export function sameState(query: string, current: string) {
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(current);
  return [...want].every(([k, v]) => have.get(k) === v);
}

// ─── Implementation notes ─────────────────────────────────────────────────────

/** The notes whole, opened at the section `anchor` names. */
export function NotesDoc({ anchor }: { anchor?: string }) {
  const doc = useRef<HTMLElement>(null);
  const landed = useRef(false);
  useEffect(() => {
    const el = anchor ? doc.current?.querySelector(`#${CSS.escape(anchor)}`) : null;
    el?.scrollIntoView({ block: "start", behavior: landed.current ? "smooth" : "instant" });
    landed.current = true;
  }, [anchor]);
  return <article ref={doc} className={`${PROSE} text-ui-text`} dangerouslySetInnerHTML={{ __html: handoff.notesHtml }} />;
}

// ─── Changes ──────────────────────────────────────────────────────────────────
//
// Newest first under the version they were made in. Which ones this browser has
// been shown is kept by id, so editing an entry never makes it new again, and
// the bar's Changes button carries a dot while any are left.

const KEY = `handoff:${handoff.slug}:seen`;
const SEEN = "handoff:seen";
const ALL = handoff.changes.flatMap((g) => g.changes.map((c) => c.id));

const readSeen = (): string[] => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const onSeen = (f: () => void) => {
  window.addEventListener(SEEN, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(SEEN, f);
    window.removeEventListener("storage", f);
  };
};

/** How many changes this browser has not been shown. */
export function useUnseen(): number {
  return useSyncExternalStore(
    onSeen,
    () => {
      const seen = new Set(readSeen());
      return ALL.filter((id) => !seen.has(id)).length;
    },
    () => 0,
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** As short as it stays clear: "15:11" today, "Yesterday 15:11", "12 Oct, 15:11",
 *  the year added when it is not this one. */
function when(written: string) {
  const m = written.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?$/);
  if (!m) return written;
  const [, y, mo, d, time] = m;
  const today = new Date().setHours(0, 0, 0, 0);
  const ago = Math.round((today - new Date(Number(y), Number(mo) - 1, Number(d)).getTime()) / 864e5);
  const date = `${Number(d)} ${MONTHS[Number(mo) - 1]}${Number(y) === new Date().getFullYear() ? "" : ` ${y}`}`;
  if (!time) return ago === 0 ? "Today" : ago === 1 ? "Yesterday" : date;
  return ago === 0 ? time : ago === 1 ? `Yesterday ${time}` : `${date}, ${time}`;
}

const quiet =
  "flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] leading-4 text-ui-dim no-underline outline-none hover:text-ui-text focus-visible:text-ui-text";

function CopyForAgent({ id, title }: { id: string; title: string }) {
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    const ok = await copyText(promptForChange(id, title));
    setSaid(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), ok ? 1200 : 2400);
  }
  return (
    <button type="button" onClick={copy} className={quiet}>
      {said === "copied" ? "Copied" : said === "failed" ? "Couldn’t copy" : "Copy for your agent"}
    </button>
  );
}

export function ChangesList({ open }: { open: (query: string) => void }) {
  // The ones new as the list opened stay marked while it is open; opening it
  // counts them all as seen.
  const [fresh] = useState(() => {
    const seen = new Set(readSeen());
    return new Set(ALL.filter((id) => !seen.has(id)));
  });
  useEffect(() => {
    if (!fresh.size) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...new Set([...readSeen(), ...ALL])]));
    } catch {
      // Without storage every change reads as new, which is the safe side.
    }
    window.dispatchEvent(new Event(SEEN));
  }, [fresh]);

  if (!handoff.changes.length)
    return <p className="m-0 text-[13px] text-ui-dim">Nothing has changed since it was handed over.</p>;

  return (
    <div className="flex flex-col gap-10">
      {handoff.changes.map((g) => (
        <section key={g.version} className="flex flex-col gap-4">
          <h3 className="m-0 border-b border-ui-line pb-2 text-[13px] leading-[18px] font-medium">v{g.version}</h3>
          {g.changes.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-dim">Nothing changed in this version.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-8 p-0">
              {g.changes.map((c) => (
                <li key={c.id} id={c.id} className="flex scroll-mt-6 flex-col gap-2">
                  <div className="flex items-baseline gap-3">
                    <h4 className="m-0 flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-[18px] font-medium">
                      {fresh.has(c.id) ? (
                        <span aria-label="New" title="New since you last looked" className="size-1.5 shrink-0 rounded-full bg-sky-400" />
                      ) : null}
                      {c.title}
                    </h4>
                    <time dateTime={c.date.replace(" ", "T")} className="shrink-0 text-[12px] leading-4 text-ui-dim tabular-nums">
                      {when(c.date)}
                    </time>
                  </div>
                  {c.html ? <div className={`${PROSE} text-ui-dim [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: c.html }} /> : null}
                  {c.impactHtml ? (
                    <p className="m-0 text-[12px] leading-4">
                      <span className="font-medium">Impact</span>{" "}
                      <span className="text-ui-dim" dangerouslySetInnerHTML={{ __html: c.impactHtml }} />
                    </p>
                  ) : null}
                  <div className="flex items-center gap-4">
                    {c.opens ? (
                      <a href={pageHref(c.opens)} onClick={(e) => followed(e, c.opens!, open)} className={quiet}>
                        Open it ↗
                      </a>
                    ) : null}
                    <CopyForAgent id={c.id} title={c.title} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
