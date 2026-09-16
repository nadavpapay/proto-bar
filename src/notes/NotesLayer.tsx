// ─── Notes on the screen ──────────────────────────────────────────────────────
//
// Review chrome, not product — LTR and English like the bar above it, whatever
// the screen under it is written in.
//
// The layer only exists while notes are ON, and while it is on it swallows every
// click: that is the mode. A pin dropped on a table row would otherwise also
// open the row, and then the note is about a screen that changed under it. HOLD
// ⌥ to hand the clicks back for as long as it is down — that is the only way to
// open a dialog, or walk one to the step worth commenting on, without leaving
// the mode and coming back.
//
// WHY PERCENTAGES OF THE CONTENT BOX, not pixels of the window. A note pinned to
// the third column of a table has to still be on that column tomorrow, on a
// different window, and after the screen below it is redrawn. Percentages of the
// screen's own scrollable content survive all three; window pixels survive none.
// The layer is sized to `scrollWidth × scrollHeight` for the same reason — on a
// screen long enough to scroll, `inset-0` would fold every note below the fold
// back onto the visible part.
//
// AND WHY THAT IS NOT ENOUGH ONCE A DIALOG IS OPEN. A dialog is centred in the
// window; the page it covers grows and shrinks with the number of rows in it. So
// the two move independently, and a note measured against the page slides off a
// dialog the moment the table is filtered. A note written while an overlay is
// open is therefore measured against THAT overlay's box and drawn only while
// that same overlay is open — which is also what stops a note about a table row
// from being drawn on top of the dialog that is covering the row.
//
// An overlay says its own name in `data-note-scope`. A name rather than the
// heading, because the heading is Hebrew copy under review and gets reworded,
// and a note whose pin disappears reads as a note that was lost.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "./store";

export interface NotesLayerProps {
  notes: Note[];
  /** Everything a new note needs to know about where it was written, except the
   *  overlay — that is read off the screen here rather than passed in, because
   *  nothing above the stage knows what a screen has opened. */
  where: Pick<Note, "screen" | "viewport" | "context">;
  onAdd: (note: Note) => void;
  onEdit: (id: string, text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  newId: () => string;
}

type Draft = { x: number; y: number; id?: string; text: string };
type Box = { l: number; t: number; w: number; h: number };

/** The popover, and the pin it hangs off. */
const PANEL = { w: 260, h: 140 };
const PIN = 28;
const EDGE = 8;

/**
 * Where a popover sits relative to its pin.
 *
 * The phone stage is a 390px frame with `overflow-hidden`, so a 260px panel
 * hung off a pin in the right half is cut in half — the Cancel button would be
 * outside the phone. So the side is chosen from where the pin actually is IN
 * THE BOX IT IS PINNED TO, in pixels: to the right when that fits, to the left
 * when that does, and otherwise held inside the box's edges — on a phone a pin
 * in the middle has room on neither side, and a panel that overlaps its own
 * pin beats one you cannot read. Vertically it opens upward near the bottom.
 */
function popover(
  x: number,
  y: number,
  w: number,
  h: number,
  /** Gap to the right of the pin — the pin's own width, or less for the
   *  composer, which has no pin yet. */
  gapRight: number,
) {
  const width = Math.min(PANEL.w, Math.max(160, w - EDGE * 2));
  const px = (x / 100) * w;
  const py = (y / 100) * h;
  let dx: number;
  if (px + gapRight + width <= w - EDGE) dx = gapRight;
  else if (px - 4 - width >= EDGE) dx = -(4 + width);
  else dx = Math.max(EDGE - px, w - EDGE - width - px);
  return { dx, width, flipY: py + PANEL.h > h };
}

/**
 * The overlay a note would belong to right now: the LAST one in the screen's
 * markup, which is the one on top when a confirmation is stacked over a drawer.
 *
 * Read off the DOM rather than passed down, because "is a dialog open" is state
 * that lives inside each screen and there are a dozen of them — plumbing it up
 * through every screen to the shell would be a change to every screen, and a
 * change every new screen would have to remember to make.
 */
function useOverlay(host: React.RefObject<HTMLDivElement | null>) {
  const [scope, setScope] = useState<{ name: string; el: HTMLElement } | null>(
    null,
  );

  useEffect(() => {
    const parent = host.current?.parentElement;
    if (!parent) return;

    const read = () => {
      const all = parent.querySelectorAll<HTMLElement>("[data-note-scope]");
      const el = all.length ? all[all.length - 1] : null;
      setScope((prev) => {
        if (!el) return prev === null ? prev : null;
        const name = el.dataset.noteScope ?? "";
        if (prev && prev.el === el && prev.name === name) return prev;
        return { name, el };
      });
    };

    // The screen below re-renders constantly; reading it back on every one of
    // those is wasted work, so the reads are coalesced to one a frame.
    let queued = 0;
    const soon = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        read();
      });
    };

    read();
    const mo = new MutationObserver(soon);
    mo.observe(parent, { childList: true, subtree: true, attributes: true });
    return () => {
      mo.disconnect();
      if (queued) cancelAnimationFrame(queued);
    };
  }, [host]);

  return scope;
}

/** Where the open overlay sits inside the layer, so its notes can be drawn over
 *  it and go on sitting on it when it moves. */
function useBox(
  host: React.RefObject<HTMLDivElement | null>,
  el: HTMLElement | null,
) {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const h = host.current;
    if (!el || !h) {
      setBox(null);
      return;
    }
    const measure = () => {
      const a = el.getBoundingClientRect();
      const b = h.getBoundingClientRect();
      const next = {
        l: a.left - b.left,
        t: a.top - b.top,
        w: a.width,
        h: a.height,
      };
      setBox((prev) =>
        prev &&
        prev.l === next.l &&
        prev.t === next.t &&
        prev.w === next.w &&
        prev.h === next.h
          ? prev
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(h);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [host, el]);

  return box;
}

/**
 * ⌥ held, which hands every click back to the screen underneath.
 *
 * `blur` and a keyless `visibilitychange` matter as much as the keyup: hold ⌥,
 * switch window, let go outside the page and the keyup never arrives — the
 * layer would stay open and the mode would look broken.
 */
function usePassThrough() {
  const [through, setThrough] = useState(false);

  useEffect(() => {
    const sync = (e: KeyboardEvent) => setThrough(e.altKey);
    const off = () => setThrough(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", off);
    document.addEventListener("visibilitychange", off);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", off);
      document.removeEventListener("visibilitychange", off);
    };
  }, []);

  return through;
}

export function NotesLayer({
  notes,
  where,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  newId,
}: NotesLayerProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const scope = useOverlay(host);
  const box = useBox(host, scope?.el ?? null);
  const through = usePassThrough();

  const name = scope?.name ?? "";
  // A note is drawn only where it was written: on the plain screen, or on the
  // same overlay. Nothing else is hidden — see `Example.tsx`.
  const shown = notes.filter((n) => (n.scope ?? "") === name);

  // The parent scrolls; the layer has to be as big as what it scrolls over.
  useLayoutEffect(() => {
    const parent = host.current?.parentElement;
    if (!parent) return;
    const measure = () =>
      setSize({
        w: Math.max(parent.scrollWidth, parent.clientWidth),
        h: Math.max(parent.scrollHeight, parent.clientHeight),
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [notes.length]);

  // A half-written note belongs to what was on the screen when it was started.
  // Open a dialog with the composer up and it would be saved against the dialog
  // at coordinates measured off the page.
  useEffect(() => {
    setDraft(null);
    setOpen(null);
  }, [name]);

  // Escape closes whatever is open, then the composer. Nothing here should ever
  // need the mouse to get out of.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (draft) setDraft(null);
      else if (open) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, open]);

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    // ⌥ held. Normally the keydown has already taken the layer out of the way
    // and this click never reaches it — but a keyup missed while the window was
    // in the background, or ⌥ pressed and clicked inside one beat, would leave
    // the layer up and drop a note where the click was meant to go. So the click
    // itself is checked too, and handed on to whatever is under it.
    if (e.altKey) {
      const layer = e.currentTarget;
      const was = layer.style.pointerEvents;
      layer.style.pointerEvents = "none";
      const under = document.elementFromPoint(e.clientX, e.clientY);
      layer.style.pointerEvents = was;
      if (under instanceof HTMLElement) under.click();
      return;
    }
    if (e.target !== e.currentTarget) return;
    const h = e.currentTarget.getBoundingClientRect();
    // Percentages of the overlay when there is one, so the pin travels with it.
    // A click on the backdrop beside an open dialog lands outside 0–100 and is
    // kept that way rather than clamped: it is a note about the space around the
    // dialog, and it should stay beside the dialog rather than snap onto it.
    const r = box
      ? { left: h.left + box.l, top: h.top + box.t, width: box.w, height: box.h }
      : h;
    setOpen(null);
    setDraft({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      text: "",
    });
  };

  const commit = () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) {
      setDraft(null);
      return;
    }
    if (draft.id) onEdit(draft.id, text);
    else
      onAdd({
        ...where,
        ...(name ? { scope: name } : null),
        id: newId(),
        x: draft.x,
        y: draft.y,
        text,
        at: new Date().toISOString(),
      });
    setDraft(null);
  };

  // Pins and the composer are positioned inside this, not inside the layer: on
  // the plain screen it IS the layer, and on an overlay it is the overlay's own
  // box. It never takes a click — those belong to the layer, which is what makes
  // the coordinates one calculation instead of two.
  const frame: React.CSSProperties = box
    ? { left: box.l, top: box.t, width: box.w, height: box.h }
    : { left: 0, top: 0, right: 0, bottom: 0 };
  const dims = box ? { w: box.w, h: box.h } : { w: size?.w ?? 0, h: size?.h ?? 0 };
  const at = draft ? popover(draft.x, draft.y, dims.w, dims.h, 8) : { dx: 0, width: PANEL.w, flipY: false };

  return (
    <div
      ref={host}
      dir="ltr"
      onClick={place}
      style={size ? { width: size.w, height: size.h } : undefined}
      // Under the bar (z-60) and over anything the screen draws.
      className={`absolute inset-0 z-[55] ${
        through ? "pointer-events-none" : "cursor-crosshair"
      }`}
    >
      {/* A wash, so it is never in doubt that clicks are going to the notes
          layer rather than to the screen. Faint enough to read the screen
          through, which is the whole job. It thins out while ⌥ is down, because
          then the clicks ARE going to the screen. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-colors ${
          through ? "bg-transparent" : "bg-sky-400/[0.06]"
        }`}
      />

      <div className="pointer-events-none absolute" style={frame}>
        {/* What the notes in view are attached to, drawn round the thing itself
            so the answer to "where did my other pins go" is on the screen rather
            than in someone's head. */}
        {box ? (
          <>
            <div className="absolute inset-0 rounded-xl ring-1 ring-sky-400/40" />
            <span className="absolute -top-6 left-0 rounded bg-sky-400 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 shadow">
              notes on {name}
            </span>
          </>
        ) : null}

        {shown.map((n, i) => (
          <Pin
            key={n.id}
            n={n}
            index={i + 1}
            dims={dims}
            open={open === n.id}
            onOpen={() => {
              setDraft(null);
              setOpen(open === n.id ? null : n.id);
            }}
            onEdit={() => {
              setOpen(null);
              setDraft({ x: n.x, y: n.y, id: n.id, text: n.text });
            }}
            onToggle={() => onToggle(n.id)}
            onDelete={() => {
              setOpen(null);
              onDelete(n.id);
            }}
          />
        ))}

        {draft ? (
          <div
            style={{
              left: `${draft.x}%`,
              top: `${draft.y}%`,
              width: at.width,
              transform: `translate(${at.dx}px, ${at.flipY ? "calc(-100% + 4px)" : "-4px"})`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute z-10 cursor-auto rounded-lg border border-ui-line bg-ui-surface p-2 shadow-xl"
          >
            <textarea
              autoFocus
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder="What's wrong here?"
              className="h-20 w-full resize-none rounded-md border border-ui-line/70 bg-transparent p-2 text-[12px] leading-relaxed text-ui-text outline-none placeholder:text-ui-dim"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={commit}
                className="h-7 cursor-pointer rounded-md border border-ui-line bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:brightness-125"
              >
                {draft.id ? "Save" : "Add note"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="h-7 cursor-pointer px-1 text-[11px] text-ui-dim hover:text-ui-text"
              >
                Cancel
              </button>
              <span className="ms-auto text-[10px] text-ui-dim">⏎ to save</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* The one thing about this mode nobody would guess. Fixed rather than
          absolute because the layer is as tall as the scrolled content, and a
          hint at the bottom of that is a hint nobody ever sees. */}
      <span
        className={`pointer-events-none fixed bottom-3 left-3 rounded-md border border-ui-line/70 px-2 py-1 text-[10px] shadow-lg transition-colors ${
          through
            ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
            : "bg-ui-surface/90 text-ui-dim"
        }`}
      >
        {through ? "clicks go to the screen" : "hold ⌥ to use the screen"}
      </span>
    </div>
  );
}

function Pin({
  n,
  index,
  dims,
  open,
  onOpen,
  onEdit,
  onToggle,
  onDelete,
}: {
  n: Note;
  index: number;
  /** The box the pin is a percent of, in px. */
  dims: { w: number; h: number };
  open: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { dx, width, flipY } = popover(n.x, n.y, dims.w, dims.h, PIN);
  return (
    <div
      style={{ left: `${n.x}%`, top: `${n.y}%` }}
      className="pointer-events-auto absolute"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onOpen}
        title={n.text}
        // The point of the pin is the top-left corner of the marker, which is
        // where the click was — not its centre. Anything else drifts by half a
        // pin every time a note is re-read.
        className={`flex size-6 cursor-pointer items-center justify-center rounded-full rounded-tl-sm text-[11px] font-semibold shadow-md hover:brightness-110 ${
          n.done
            ? "bg-ui-line text-ui-dim line-through"
            : "bg-sky-400 text-slate-900"
        }`}
      >
        {index}
      </button>

      {open ? (
        <div
          style={{
            width,
            transform: `translate(${dx}px, ${flipY ? "calc(-100% + 24px)" : "0"})`,
          }}
          className="absolute top-0 left-0 z-10 cursor-auto rounded-lg border border-ui-line bg-ui-surface p-2.5 shadow-xl"
        >
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ui-text">
            {n.text}
          </p>
          <div className="mt-2 flex items-center gap-2 border-t border-ui-line/70 pt-2">
            <button
              type="button"
              onClick={onToggle}
              className="h-6 cursor-pointer rounded-md border border-ui-line/70 px-2 text-[11px] text-ui-text hover:bg-ui-raised"
            >
              {n.done ? "Reopen" : "Done"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="h-6 cursor-pointer px-1 text-[11px] text-ui-dim hover:text-ui-text"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="ms-auto h-6 cursor-pointer px-1 text-[11px] text-ui-dim hover:text-rose-400"
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
