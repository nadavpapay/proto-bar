// ─── The sheet the handoff's pages open in ────────────────────────────────────
//
// States, Changes and the implementation notes open over the prototype rather
// than in its place, so nothing on it is lost by looking something up. It hangs
// from the foot of the bar down the right of the window, and the prototype
// beside it stays live: a screen can be clicked through with the notes open
// next to it.
//
// Chrome like the bar: `ui-*` tokens, LTR, marked with `chrome` so a dialog in
// the app does not count a press on it as a press outside. The bar's button
// that opened it closes it again, as do its close button and Escape — but only
// an Escape the prototype did not take: one pressed inside the prototype is
// the prototype's.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { chrome, isChrome } from "../chrome";
import { iconBtn } from "../parts";

const ours = (el: EventTarget | null) =>
  !(el instanceof Element) || el === document.body || isChrome(el);

export function Sheet({
  open,
  title,
  about,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  about?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  // What it showed is kept while it slides away.
  const last = useRef({ title, about, children });
  if (open) last.current = { title, about, children };
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), 250);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) body.current?.focus({ preventScroll: true });
  }, [open, title]);

  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !ours(e.target)) return;
      e.preventDefault();
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted) return null;
  const shown = last.current;
  return createPortal(
    <aside
      {...chrome}
      dir="ltr"
      aria-label={shown.title}
      inert={!open}
      // Under the bar, whatever height it has wrapped to; above anything the
      // stage draws, under the bar's own menus.
      style={{ top: "var(--proto-bar-h, 0px)" }}
      className={`pointer-events-auto fixed right-0 bottom-0 z-[59] flex w-[min(560px,100vw)] flex-col border-l border-ui-line bg-ui-surface text-ui-text shadow-[-24px_0_48px_-32px_rgb(0_0_0/0.6)] transition-[translate,opacity] duration-200 ease-out starting:translate-x-8 starting:opacity-0 motion-reduce:transition-none ${
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0"
      }`}
    >
      <header className="flex shrink-0 items-start gap-4 border-b border-ui-line px-6 pt-5 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="m-0 text-[14px] leading-5 font-medium">{shown.title}</h2>
          {shown.about ? <p className="m-0 text-[12px] leading-4 text-ui-dim">{shown.about}</p> : null}
        </div>
        <button type="button" onClick={onClose} title="Close  (Esc)" aria-label="Close" className={`${iconBtn} -mt-1 -mr-2`}>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      {/* A page of its own each time: switching starts at its top. */}
      <div
        key={shown.title}
        ref={body}
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-12 outline-none"
      >
        {shown.children}
      </div>
    </aside>,
    document.body,
  );
}
