// The bar, minimised: the hide button, flipped. Same size, same spot, same
// gutter as the hide button it replaces — so it reads as the one control
// staying put rather than the bar being swapped for a different thing.
//
// It drags anywhere, because whatever corner it defaults to is eventually the
// corner covering the thing you want to look at. Drag and click share one
// pointer: a press that moves less than a few pixels is a click, anything more
// is a drag. Its position is remembered per `storeKey`.

import { useCallback, useEffect, useRef, useState } from "react";
import { chrome } from "./chrome";

const EDGE = 6;                       // how close to a window edge it may be dragged
const BAR_INSET = 16;                 // the expanded bar's own px-4 gutter
const BAR_CENTRE = 22;                // half the 44px bar — where the hide button sits
const PILL = { w: 28, h: 28 };        // the bar's own icon-button size
const DRAG_THRESHOLD = 4;

type Pos = { x: number; y: number };

function clamp(p: Pos): Pos {
  return {
    x: Math.min(Math.max(p.x, EDGE), Math.max(EDGE, window.innerWidth - PILL.w - EDGE)),
    y: Math.min(Math.max(p.y, EDGE), Math.max(EDGE, window.innerHeight - PILL.h - EDGE)),
  };
}

/** Top right — same right gutter as the hide button, centred on the same line,
 *  so pressing hide does not make the control appear to jump. */
function defaultPos(): Pos {
  return clamp({
    x: window.innerWidth - PILL.w - BAR_INSET,
    y: BAR_CENTRE - PILL.h / 2,
  });
}

export function CollapsedPill({
  title,
  onExpand,
  storeKey = "proto-bar:pill",
  hideKey = "\\",
}: {
  /** Named in the tooltip — the project or the screen, whatever the bar names. */
  title: string;
  onExpand: () => void;
  /** localStorage key the position is kept under. One per app, or two apps on
   *  one origin fight over the corner. */
  storeKey?: string;
  /** The key wired to show the bar again, named in the tooltip. */
  hideKey?: string;
}) {
  const [pos, setPos] = useState<Pos>(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) return clamp(JSON.parse(saved) as Pos);
    } catch {
      // A corrupt or blocked store is not worth a crash — fall back to default.
    }
    return defaultPos();
  });

  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Keep it on screen when the window changes size, or it strands itself off
  // the edge and there is no way to get it back.
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    if (!d.moved) {
      const r = e.currentTarget.getBoundingClientRect();
      if (Math.abs(next.x - r.left) + Math.abs(next.y - r.top) > DRAG_THRESHOLD) d.moved = true;
    }
    if (d.moved) setPos(next);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (!d) return;
      if (d.moved) {
        setPos((p) => {
          try {
            localStorage.setItem(storeKey, JSON.stringify(p));
          } catch {
            // Nothing to do — the pill just won't remember where it was put.
          }
          return p;
        });
      } else {
        onExpand();
      }
    },
    [onExpand, storeKey],
  );

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      }}
      title={`${title} — show the bar  (${hideKey})  ·  drag to move`}
      aria-label="Show the bar"
      {...chrome}
      style={{ left: pos.x, top: pos.y, width: PILL.w, height: PILL.h, touchAction: "none" }}
      // The bar's own level, above the app's dialogs and their backdrops — the
      // way back to the bar must never be under the thing being reviewed.
      // `pointer-events-auto` because a modal that is up turns them off.
      className={`pointer-events-auto fixed z-[60] flex select-none items-center justify-center rounded-md border border-ui-line bg-ui-surface/90 text-ui-dim shadow-lg backdrop-blur-sm transition-colors hover:text-ui-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-dim ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 rotate-180" fill="none" aria-hidden>
        <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
