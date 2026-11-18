// ─── The handoff's half of the bar ────────────────────────────────────────────
//
//   lead={<HandoffName />}
//   tail={<HandoffTail screen={screen} />}
//
// A prototype bar is for the design review; a handoff bar is for the people
// who build it. The difference is all in the two ends: the name is fixed (no
// version picker, every decision is closed) and wears a Handoff mark, and the
// tail holds what a developer reaches for instead of review notes — the Code
// menu, every state, what changed, and the implementation notes. The pickers
// in the middle stay the project's own.
//
// The three pages open in one sheet beside the prototype; the button that
// opened one is lit while it shows and closes it again. A link inside to a
// state opens it in place through `open`, which by default goes to the address.

import { useState } from "react";
import { Sheet } from "./Sheet";
import { ChangesList, NotesDoc, StatesList, useUnseen } from "./pages";
import { CodeMenu } from "./CodeMenu";
import { handoff, pageHref, version } from "./prompts";

type Page = "states" | "changes" | "notes";

/** The fixed name, with the mark that says this is the version to build. */
export function HandoffName() {
  return (
    <span className="flex h-7 shrink-0 items-center gap-2 text-[11px] font-medium text-ui-text">
      <span className="rounded border border-emerald-400/50 bg-emerald-400/15 px-1.5 py-px text-[10px] font-semibold tracking-wide text-emerald-200 uppercase">
        Handoff
      </span>
      <span className="whitespace-nowrap">
        {handoff.name} <span className="tabular-nums text-ui-dim">{version}</span>
      </span>
    </span>
  );
}

function SheetButton({ on, onClick, children, dot }: { on: boolean; onClick: () => void; children: string; dot?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
        on ? "border-ui-dim/60 bg-ui-raised text-ui-text" : "border-ui-line/70 text-ui-text hover:bg-ui-raised"
      }`}
    >
      {children}
      {dot ? <span aria-label="New changes" className="size-1.5 rounded-full bg-sky-400" /> : null}
    </button>
  );
}

const go = (query: string) => {
  window.location.assign(pageHref(query));
};

export function HandoffTail({
  screen,
  open = go,
}: {
  /** The key in `handoff.config.ts` of the screen on the page. */
  screen?: string;
  /** Open a state by its query. Default: go to its address. */
  open?: (query: string) => void;
}) {
  const [page, setPage] = useState<Page | null>(null);
  const unseen = useUnseen();
  const toggle = (p: Page) => setPage(page === p ? null : p);
  const here = screen ? handoff.screens[screen] : undefined;
  // The address as it stands, so the States list marks the one showing.
  const current = typeof window === "undefined" ? "" : window.location.search;

  const pages: Record<Page, { title: string; about: string }> = {
    states: { title: "States", about: "Every state of every screen. Open one to land on it." },
    changes: { title: "Changes", about: "What changed since it was handed over, newest first." },
    notes: {
      title: "Implementation notes",
      about: here ? `The rules the prototype can't show. Opened at ${here.title}.` : "The rules the prototype can't show.",
    },
  };

  return (
    <>
      <CodeMenu screen={screen} />
      <SheetButton on={page === "states"} onClick={() => toggle("states")}>
        States
      </SheetButton>
      <SheetButton on={page === "changes"} onClick={() => toggle("changes")} dot={unseen > 0 && page !== "changes"}>
        Changes
      </SheetButton>
      <SheetButton on={page === "notes"} onClick={() => toggle("notes")}>
        Implementation notes
      </SheetButton>

      <Sheet open={page !== null} title={page ? pages[page].title : ""} about={page ? pages[page].about : undefined} onClose={() => setPage(null)}>
        {page === "states" ? <StatesList current={current} open={open} /> : null}
        {page === "changes" ? <ChangesList open={open} /> : null}
        {page === "notes" ? <NotesDoc anchor={here?.notes[0]} /> : null}
      </Sheet>
    </>
  );
}
