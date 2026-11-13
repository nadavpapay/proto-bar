// ─── The stage ────────────────────────────────────────────────────────────────
//
// Everything below the bar. Both views sit on a dotted canvas, so the screen
// reads as an object placed on a workbench and never blends into the bar or a
// side rail. Desktop keeps its real size: it fills the canvas less a 40px gap
// on each side and scrolls inside its own card, because a screen judged at 80%
// in a Figma frame is a screen nobody has actually read. Mobile draws a
// real 390×844 viewport rather than scaling the desktop one down — the phone
// layout is the hard half of most jobs and a scaled screenshot hides exactly
// the problems worth finding. Looked at ON a phone, the phone layout is the
// window: edge to edge at the window's own size, no frame.
//
// `dir` and `lang` are set here, once, so no screen has to remember them and
// no screen can forget — the stage is the one place the product's own
// direction and language apply; the bar above it is always LTR.

import type { CSSProperties, ReactNode } from "react";
import { usePhone, type Viewport } from "./parts";

const MOBILE = { w: 390, h: 844 };

// The canvas: the bar's own ground with a faint 20px dot grid on it.
const CANVAS: CSSProperties = {
  backgroundColor: "var(--color-ui-bg)",
  backgroundImage: "radial-gradient(circle, var(--color-ui-line) 1px, transparent 1.5px)",
  backgroundSize: "20px 20px",
  backgroundPosition: "10px 10px",
};

export function Stage({
  viewport,
  dir = "ltr",
  lang,
  style,
  className = "bg-white",
  children,
  overlay,
}: {
  viewport: Viewport;
  dir?: "ltr" | "rtl";
  lang?: string;
  /** The product's font, say. */
  style?: CSSProperties;
  /** The screen's background, and anything else on its box. */
  className?: string;
  children?: ReactNode;
  /**
   * Drawn INSIDE the screen's own box, over the top of it — the notes layer.
   * It goes here rather than over the whole window because a note is pinned
   * to a place on the SCREEN: on the phone that is a 390px frame in the middle
   * of a grey field, and a pin measured against the window would land
   * somewhere else the moment the window changed.
   */
  overlay?: ReactNode;
}) {
  const phone = usePhone();

  if (viewport === "mobile" && !phone) {
    return (
      // Scroll container outside, centring inside. `margin:auto` on a flex item
      // that overflows its container clips the top edge — the phone is 844
      // tall and most laptop viewports are shorter.
      <div className="min-h-0 flex-1 overflow-auto" style={CANVAS}>
        <div className="flex min-h-full items-center justify-center p-8">
          <div
            dir={dir}
            lang={lang}
            style={{ width: MOBILE.w, height: MOBILE.h, ...style }}
            className={`relative shrink-0 overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/10 ${className}`}
          >
            {children}
            {overlay}
          </div>
        </div>
      </div>
    );
  }

  // On a phone the window is the screen: edge to edge, no canvas.
  if (phone) {
    return (
      <div
        dir={dir}
        lang={lang}
        style={style}
        className={`relative min-h-0 flex-1 ${viewport === "mobile" ? "overflow-hidden" : "overflow-auto"} ${className}`}
      >
        {children}
        {overlay}
      </div>
    );
  }

  // Desktop: the screen is a card on the canvas, and it scrolls inside the card
  // so the canvas stays still and the product's sticky header sticks to the
  // card's top edge, not into the gap above it.
  return (
    <div className="flex min-h-0 flex-1 flex-col px-10 py-6" style={CANVAS}>
      <div
        dir={dir}
        lang={lang}
        style={style}
        className={`relative min-h-0 flex-1 overflow-auto rounded-xl shadow-2xl ring-1 ring-white/10 ${className}`}
      >
        {children}
        {overlay}
      </div>
    </div>
  );
}
