// ─── The stage ────────────────────────────────────────────────────────────────
//
// Everything below the bar. Desktop fills the viewport, because a screen judged
// at 80% in a Figma frame is a screen nobody has actually read. Mobile draws a
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
      <div className="min-h-0 flex-1 overflow-auto bg-ui-raised">
        <div className="flex min-h-full items-center justify-center p-8">
          <div
            dir={dir}
            lang={lang}
            style={{ width: MOBILE.w, height: MOBILE.h, ...style }}
            className={`relative shrink-0 overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-black/20 ${className}`}
          >
            {children}
            {overlay}
          </div>
        </div>
      </div>
    );
  }

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
