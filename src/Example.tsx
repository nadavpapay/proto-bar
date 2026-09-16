// ─── A whole bar, wired up ────────────────────────────────────────────────────
//
// The demo `npm run dev` shows, and the shape to copy: state in the app, the
// bar told what it is and what to call, the notes layer over the stage.
// Nothing here persists to the URL — that is the app's business, and a
// `useSearchParams` around this state is all it takes.

import { useState } from "react";
import {
  BarFrame,
  BarSelect,
  CollapsedPill,
  ModeButton,
  NotesLayer,
  NotesMenu,
  ReadyMark,
  Segments,
  Stage,
  ViewportSwitch,
  newId,
  useBarKeys,
  useNotesStore,
  type Note,
  type Viewport,
} from ".";

const SCREENS = [
  { id: "home", label: "Home" },
  { id: "orders", label: "Orders" },
  { id: "order", label: "Order detail" },
  { id: "settings", label: "Settings", menu: "Settings — not drawn yet" },
];

const STATES = [
  { id: "default", label: "Default" },
  { id: "empty", label: "Empty" },
  { id: "long", label: "Long list" },
];

const VERSIONS = [
  { id: "v3", label: "v3" },
  { id: "v2", label: "v2", menu: "v2 — before the split" },
  { id: "v1", label: "v1" },
];

export function Example() {
  const [collapsed, setCollapsed] = useState(false);
  const [screen, setScreen] = useState("orders");
  const [version, setVersion] = useState("v3");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [state, setState] = useState("default");
  const [proto, setProto] = useState("wire");
  const [map, setMap] = useState(false);

  // ── Review notes ───────────────────────────────────────────────────────────
  //
  // The whole file, and this screen's slice of it. A note belongs to a screen
  // and a viewport; the version and state are recorded on it but do NOT hide
  // it — a pin that vanishes when a selector moves reads as a lost note.
  const { notes, write, where } = useNotesStore();
  const [notesOn, setNotesOn] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const here = notes.filter((n) => n.screen === screen && n.viewport === viewport);
  const openHere = here.filter((n) => !n.done);

  const edit = (id: string, text: string) => write(notes.map((n) => (n.id === id ? { ...n, text } : n)));
  const toggle = (id: string) => write(notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  const remove = (id: string) => write(notes.filter((n) => n.id !== id));

  // Everything the note was written under, restored in one go. Anything less
  // and the note points at a screen that is not the screen it was about.
  const jump = (n: Note) => {
    setMap(false);
    setScreen(n.screen);
    setViewport(n.viewport as Viewport);
    if (n.context?.version) setVersion(n.context.version);
    if (n.context?.state) setState(n.context.state);
    setNotesOn(true);
    if (n.done) setShowDone(true);
  };

  useBarKeys({
    "\\": () => setCollapsed((c) => !c),
    n: () => setNotesOn((on) => !on),
  });

  const label = SCREENS.find((s) => s.id === screen)?.label ?? screen;

  return (
    <div className="flex h-full flex-col">
      {collapsed ? (
        <CollapsedPill title={label} onExpand={() => setCollapsed(false)} />
      ) : (
        <BarFrame
          caption="Acme redesign"
          onCollapsed={setCollapsed}
          lead={
            <Segments
              label="Prototype"
              value={proto}
              onChange={setProto}
              options={[
                { id: "wire", label: "Wireframe" },
                { id: "design", label: "Design" },
              ]}
            />
          }
          leadCompact={
            <Segments
              label="Prototype"
              value={proto}
              onChange={setProto}
              options={[
                { id: "wire", label: "Wire" },
                { id: "design", label: "Design" },
              ]}
            />
          }
          primary={<BarSelect primary label="Screen" options={SCREENS} value={screen} onChange={setScreen} />}
          tail={
            <>
              <ModeButton on={map} onClick={() => setMap(!map)} title="Every screen on one page">
                Map
              </ModeButton>
              <NotesMenu
                notes={notes}
                here={openHere.length}
                hereAll={here.length}
                on={notesOn}
                onToggle={() => setNotesOn(!notesOn)}
                showDone={showDone}
                onShowDone={setShowDone}
                where={where}
                onJump={jump}
              />
              <ReadyMark
                ready={openHere.length === 0 && !map}
                title={
                  here.length
                    ? `Nothing open on this screen — all ${here.length} notes on it are done`
                    : "Nothing open on this screen — no notes written on it yet"
                }
              />
            </>
          }
        >
          <BarSelect
            label="Version"
            options={VERSIONS}
            value={version}
            onChange={setVersion}
            className="font-semibold tabular-nums"
          />
          <ViewportSwitch viewport={viewport} onViewport={setViewport} />
          <BarSelect label="State" options={STATES} value={state} onChange={setState} />
        </BarFrame>
      )}

      {map ? (
        <main className="flex min-h-0 flex-1 items-center justify-center bg-ui-bg text-[13px] text-ui-dim">
          the page map
        </main>
      ) : (
        <Stage
          viewport={viewport}
          className="bg-neutral-100 text-neutral-800"
          overlay={
            notesOn ? (
              <NotesLayer
                notes={showDone ? here : openHere}
                where={{ screen, viewport, context: { version, state } }}
                onAdd={(n) => write([...notes, n])}
                onEdit={edit}
                onToggle={toggle}
                onDelete={remove}
                newId={newId}
              />
            ) : null
          }
        >
          <FakeScreen key={screen} label={`${proto} · ${label} · ${version} · ${state}`} rows={state === "long" ? 40 : state === "empty" ? 0 : 8} />
        </Stage>
      )}
    </div>
  );
}

/** Something to pin notes on, with a dialog that names itself as a scope. */
function FakeScreen({ label, rows }: { label: string; rows: number }) {
  const [dialog, setDialog] = useState(false);
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-[15px] font-semibold">{label}</h1>
        <button
          type="button"
          onClick={() => setDialog(true)}
          className="ms-auto h-8 rounded-md bg-neutral-800 px-3 text-[12px] font-medium text-white"
        >
          New order
        </button>
      </div>
      {rows === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-[13px] text-neutral-500">
          Nothing here yet
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex gap-6 border-b border-neutral-100 px-4 py-2.5 text-[13px] last:border-0">
              <span className="w-16 tabular-nums text-neutral-400">#{1040 + i}</span>
              <span className="flex-1">Order {i + 1}</span>
              <span className="text-neutral-500">{i % 3 === 0 ? "Shipped" : "Open"}</span>
            </div>
          ))}
        </div>
      )}
      {dialog ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setDialog(false)}>
          <div
            data-note-scope="new-order"
            onClick={(e) => e.stopPropagation()}
            className="w-[360px] rounded-xl bg-white p-5 shadow-2xl"
          >
            <h2 className="text-[14px] font-semibold">New order</h2>
            <p className="mt-2 text-[13px] text-neutral-500">
              A dialog. Notes dropped here are measured against this box and drawn only while it is open.
            </p>
            <button
              type="button"
              onClick={() => setDialog(false)}
              className="mt-4 h-8 rounded-md border border-neutral-300 px-3 text-[12px]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
