// ─── What the app's own dialogs need to know about the review chrome ─────────
//
// The one place the product has to hear about the bar. A modal dialog — Radix,
// Headless UI, a native <dialog> opened with showModal — traps focus inside
// itself, turns pointer events off for everything else, and closes on a press
// outside. Every one of those defeats a note being written ON the dialog: the
// composer cannot take focus, the notes layer cannot take the click, and the
// click that does get through closes the thing being commented on.
//
// So the notes layer says when it is up (`useNotesMode`), and every piece of
// chrome carries a marker (`CHROME`). A dialog in the app does two things:
//
//   const notes = useNotesMode();
//   <Dialog modal={!notes}>
//     <DialogContent onInteractOutside={(e) => {
//       if (isChrome(e.detail?.originalEvent?.target ?? e.target)) e.preventDefault();
//     }}>
//
// — non-modal while notes are on, and a press on the bar, the pill or the layer
// is never a press "outside" it. A module-level flag rather than a context, so
// the dialog does not have to sit inside a provider the chrome owns.
//
// The chrome also forces `pointer-events-auto` on itself, because a modal that
// is still up sets `pointer-events: none` on the body.

import { useSyncExternalStore } from "react";

/** The attribute every piece of chrome wears. */
export const CHROME = "data-proto-chrome";

/** Spread onto an element to mark it as chrome: `<div {...chrome}>`. */
export const chrome = { [CHROME]: "" } as const;

/** Did this press land on the bar, the pill, a bar menu or the notes layer? */
export function isChrome(target: EventTarget | null | undefined): boolean {
  return target instanceof Element && !!target.closest(`[${CHROME}]`);
}

let on = false;
const subs = new Set<() => void>();

/** Set by `NotesLayer` while it is mounted. */
export function setNotesMode(next: boolean) {
  if (on === next) return;
  on = next;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Is the notes layer up? For the app's dialogs — see above. */
export function useNotesMode(): boolean {
  return useSyncExternalStore(subscribe, () => on, () => false);
}
