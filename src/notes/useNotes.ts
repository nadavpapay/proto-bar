// ─── The notes, as React state ────────────────────────────────────────────────
//
// EVERY CHANGE WRITES THE WHOLE FILE. It is one person and a few dozen notes,
// and `where` is the truth about what just happened — the dev server can go
// away mid-session, and a note silently landing in localStorage instead of the
// repo is exactly the failure this feature cannot have.

import { useCallback, useEffect, useMemo, useState } from "react";
import { notesStore, type Note, type Where } from "./store";

export function useNotesStore(localKey?: string): {
  notes: Note[];
  /** Writes the whole file. */
  write: (next: Note[]) => void;
  where: Where;
} {
  const store = useMemo(() => notesStore(localKey), [localKey]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [where, setWhere] = useState<Where>("browser");

  useEffect(() => {
    let live = true;
    store.load().then((r) => {
      if (!live) return;
      setNotes(r.notes);
      setWhere(r.where);
    });
    return () => {
      live = false;
    };
  }, [store]);

  const write = useCallback(
    (next: Note[]) => {
      setNotes(next);
      store.save(next).then(setWhere);
    },
    [store],
  );

  return { notes, write, where };
}
