// ─── A whole bar, wired up ────────────────────────────────────────────────────
//
// The demo `npm run dev` shows, and the shape to copy: state in the app, the
// bar told what it is and what to call. Nothing here persists to the URL —
// that is the app's business, and a `useSearchParams` around this state is
// all it takes.

import { useState } from "react";
import {
  BarFrame,
  BarSelect,
  CollapsedPill,
  ModeButton,
  ReadyMark,
  Segments,
  ViewportSwitch,
  useBarKeys,
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

  useBarKeys({ "\\": () => setCollapsed((c) => !c) });

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
              <ReadyMark ready={screen === "home"} title="Nothing open on this screen" />
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

      {/* The stage. `flex-1` so it gives up the bar's second row when the bar
          wraps; `min-h-0` so it scrolls inside rather than growing the page. */}
      <main className="flex min-h-0 flex-1 items-center justify-center bg-ui-bg text-ui-dim">
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-ui-line text-[13px]"
          style={{ width: viewport === "mobile" ? 390 : "min(1200px, 90%)", height: "70%" }}
        >
          {map ? "the page map" : `${proto} · ${label} · ${version} · ${state}`}
        </div>
      </main>
    </div>
  );
}
