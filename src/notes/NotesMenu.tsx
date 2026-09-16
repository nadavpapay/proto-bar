// ─── The notes control in the bar ─────────────────────────────────────────────
//
// Two halves of one control: the left toggles the layer on the screen, the right
// opens the list of everything written so far. They are one shape because they
// are one subject, and the count sits on the toggle because "are there notes on
// this screen" is the question asked from across the room.
//
// The list is the whole file, not just this screen — the point of it is finding
// the note you left on some other screen two days ago. Clicking one goes back to
// exactly where it was written: the screen, the viewport and everything in its
// `context` — a version, a state — because a note about a layout is
// meaningless next to the other layout.
//
// DONE NOTES ARE KEPT AND HIDDEN. They stay in the file as the record of what
// was raised, but they are out of the list and off the screen unless Show done
// is on — a fixed note left in view is a fixed note re-read, and after a couple
// of review rounds the struck-through ones outnumber the live ones. The count on
// the toggle is open notes only, and it says 0 rather than disappearing when a
// screen's notes have all been dealt with: 0 is the finished screen, nothing at
// all is the screen nobody has reviewed.

import { useEffect, useRef, useState } from "react";
import { PHONE_PANEL } from "../parts";
import { asText, type Note, type Where } from "./store";

export function NotesMenu({
  notes,
  here,
  hereAll,
  on,
  onToggle,
  showDone,
  onShowDone,
  where,
  onJump,
}: {
  notes: Note[];
  /** How many OPEN notes are on the screen currently open. */
  here: number;
  /** How many notes it holds in total, done ones included. */
  hereAll: number;
  on: boolean;
  onToggle: () => void;
  showDone: boolean;
  onShowDone: (show: boolean) => void;
  where: Where;
  onJump: (n: Note) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);

  const live = notes.filter((n) => !n.done);
  const done = notes.length - live.length;
  const shown = showDone ? notes : live;

  return (
    <div ref={box} className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={onToggle}
        title={on ? "Stop adding notes  (n)" : "Click anywhere on the screen to leave a note  (n)"}
        className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-s-md border px-2.5 text-[11px] font-medium transition-colors ${
          on
            ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
            : "border-ui-line/70 text-ui-text hover:bg-ui-raised"
        }`}
      >
        <NoteMark />
        Notes
        {/* KEPT IN THE LAYOUT WHEN THERE ARE NO NOTES AT ALL, and still drawn
            only when there are — the difference between 0 and nothing is the
            difference between a finished screen and an unreviewed one, and that
            distinction is the reason this is not simply always showing 0.
            Invisible rather than hidden, so the button is the same width on the
            screen with 22 notes and the screen with none, and the buttons
            beside it stay where you left them. Two digits of
            room for the same reason. */}
        <span
          aria-hidden={hereAll === 0}
          title={
            hereAll === 0
              ? undefined
              : here === 0
                ? `All ${hereAll} note${hereAll === 1 ? "" : "s"} on this screen are done`
                : `${here} open on this screen`
          }
          className={`inline-block min-w-[2ch] rounded bg-ui-raised px-1 text-center tabular-nums text-ui-dim ${
            hereAll > 0 ? "" : "invisible"
          }`}
        >
          {here}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="All notes"
        title="All notes"
        className="flex h-7 cursor-pointer items-center rounded-e-md border border-s-0 border-ui-line/70 px-1.5 text-ui-dim hover:bg-ui-raised hover:text-ui-text"
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
          <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        // The window's width on a phone, under the bar's row — see `PHONE_PANEL`.
        <div className={`absolute end-0 top-full z-[70] mt-1.5 max-h-[70vh] w-[360px] overflow-auto rounded-lg border border-ui-line bg-ui-surface p-1.5 shadow-2xl max-sm:max-h-[calc(100dvh-64px)] ${PHONE_PANEL}`}>
          <div className="flex items-center gap-2 px-1.5 py-1">
            <span className="text-[11px] font-medium text-ui-text">
              {live.length} open{done > 0 ? ` · ${done} done` : ""}
            </span>
            <div className="ms-auto flex items-center gap-1.5">
              {done > 0 ? (
                <button
                  type="button"
                  onClick={() => onShowDone(!showDone)}
                  title={
                    showDone
                      ? "Hide the done ones here and on the screen"
                      : "Show the done ones here and on the screen"
                  }
                  className={`h-6 cursor-pointer rounded-md border px-2 text-[11px] transition-colors ${
                    showDone
                      ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
                      : "border-ui-line/70 text-ui-dim hover:bg-ui-raised hover:text-ui-text"
                  }`}
                >
                  Show done
                </button>
              ) : null}
              {notes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(asText(notes));
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="h-6 cursor-pointer rounded-md border border-ui-line/70 px-2 text-[11px] text-ui-text hover:bg-ui-raised"
                >
                  {copied ? "Copied" : "Copy all"}
                </button>
              ) : null}
            </div>
          </div>

          {/* Where they are actually being kept, which is not the same promise
              in all three cases — so it says which one rather than implying the
              best one. */}
          <p className="px-1.5 pb-1.5 text-[10px] leading-relaxed text-ui-dim">
            {where === "file"
              ? "Saved to notes.json in the repo — say “look at the notes” and they get read."
              : where === "inbox"
                ? "Saved on the server and kept through redeploys. They land in the repo next time the dev server runs."
                : "Nothing to save to from here, so these live in this browser only. Use Copy all and paste them into the chat."}
          </p>

          {shown.length === 0 ? (
            <p className="px-1.5 py-3 text-center text-[11px] text-ui-dim">
              {notes.length === 0
                ? "Turn Notes on and click anything on the screen."
                : `Nothing open. ${done} done note${done === 1 ? "" : "s"} kept — Show done to read them.`}
            </p>
          ) : (
            shown.map((n, i) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onJump(n);
                  setOpen(false);
                }}
                className="flex w-full gap-2 rounded-md px-1.5 py-1.5 text-start hover:bg-ui-raised"
              >
                <span
                  className={`mt-px flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                    n.done ? "bg-ui-line text-ui-dim" : "bg-sky-400 text-slate-900"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[11px] ${
                      n.done ? "text-ui-dim line-through" : "text-ui-text"
                    }`}
                  >
                    {n.text}
                  </span>
                  <span className="block truncate text-[10px] text-ui-dim">
                    {n.screen} · {n.viewport}
                    {Object.entries(n.context ?? {})
                      .map(([k, v]) => ` · ${k} ${v}`)
                      .join("")}
                    {/* Which overlay it is pinned to, because jumping to it
                        lands on the screen with that overlay shut and the pin
                        therefore not drawn — this is the line that says what
                        to open. */}
                    {n.scope ? ` · on “${n.scope}”` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A glyph says which control this is, where a coloured dot would only say
 *  that it had a state. */
function NoteMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 opacity-70"
      fill="none"
      aria-hidden
    >
      <path
        d="M13 9.5A1.5 1.5 0 0 1 11.5 11H6.8L4 13.2V4.5A1.5 1.5 0 0 1 5.5 3h6A1.5 1.5 0 0 1 13 4.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
