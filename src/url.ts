// ─── State in the address ─────────────────────────────────────────────────────
//
// A picker's value kept in the query string, so a link opens the same place:
// the screen, the viewport, the state, whether notes are on. Every job was
// writing this by hand.
//
// Only its own key is touched — anything else in the address (a tracking
// parameter, a send date) is left as it was. Replaced, not pushed: flipping
// through twenty screens is not twenty presses of Back.
//
// Read as an external store, so a server-rendered page draws the fallback on
// the server and the address's value once loaded, without a mismatch.

import { useCallback, useSyncExternalStore } from "react";

const CHANGE = "proto-bar:url";

function subscribe(f: () => void) {
  window.addEventListener("popstate", f);
  window.addEventListener(CHANGE, f);
  return () => {
    window.removeEventListener("popstate", f);
    window.removeEventListener(CHANGE, f);
  };
}

/** `[value, set]` for one query-string key. A value that is not one of
 *  `allowed` — a stale link, a typo — reads as `fallback`. */
export function useUrlState<T extends string>(
  key: string,
  fallback: T,
  allowed?: readonly T[],
): [T, (next: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key),
    () => null,
  );
  const value =
    raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? (raw as T) : fallback;

  const set = useCallback(
    (next: T) => {
      const q = new URLSearchParams(window.location.search);
      q.set(key, next);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}${window.location.hash}`);
      window.dispatchEvent(new Event(CHANGE));
    },
    [key],
  );

  return [value, set];
}
