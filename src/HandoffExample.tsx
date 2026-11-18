// ─── A handoff bar, wired up ──────────────────────────────────────────────────
//
// The demo at /handoff/, and the shape to copy. The same frame as the review
// bar in `Example.tsx`, with the two ends swapped: the name is fixed and wears
// the Handoff mark, and the tail is the developer's — Code, States, Changes,
// Implementation notes — in place of review notes.
//
// The pickers read the screens and states from `handoff.config.ts` through
// `virtual:handoff`, so the bar, the States sheet and the pack can never list
// different things. Everything is in the address, so a state's query in the
// config opens exactly that state.

import { useState } from "react";
import { BarFrame, BarSelect, CollapsedPill, Stage, ViewportSwitch, useBarKeys, usePhone, useUrlState, type Viewport } from ".";
import { HandoffName, HandoffTail, handoff, sameState } from "./handoff";
import { Home } from "./demo/Home";
import { OrderDetail } from "./demo/OrderDetail";
import { Orders } from "./demo/Orders";

const SCREENS = Object.entries(handoff.screens).map(([id, s]) => ({ id, label: s.title }));
const ALL_STATES = Object.values(handoff.screens).flatMap((s) => s.states.map((st) => st.label));

/** The `state` value a configured state sets, or "default". */
const stateOf = (query: string) => new URLSearchParams(query).get("state") ?? "default";

export function HandoffExample() {
  const phone = usePhone();
  const [collapsed, setCollapsed] = useState(false);
  const [screen, setScreen] = useUrlState("screen", SCREENS[0].id, SCREENS.map((s) => s.id));
  const [viewport, setViewport] = useUrlState<Viewport>("v", phone ? "mobile" : "desktop", ["desktop", "mobile"]);
  const [state, setState] = useUrlState<string>("state", "default");
  const [order, setOrder] = useState(1040);

  useBarKeys({ "\\": () => setCollapsed((c) => !c) });

  // This screen's states as the picker lists them: each named by its config
  // label, keyed by the `state` it sets. A state that only changes the
  // viewport is the viewport switch's, not this picker's.
  const states = handoff.screens[screen].states
    .filter((s) => !new URLSearchParams(s.query).has("v"))
    .map((s) => ({ id: stateOf(s.query), label: s.label }));
  const current = states.some((s) => s.id === state) ? state : "default";

  // Opening a state from the States or Changes sheet, in place.
  const open = (query: string) => {
    const q = new URLSearchParams(query);
    setScreen(q.get("screen") ?? SCREENS[0].id);
    setState(q.get("state") ?? "default");
    if (q.get("v")) setViewport(q.get("v") as Viewport);
  };

  const label = handoff.screens[screen].title;
  const showing = handoff.screens[screen].states.find((s) => sameState(s.query, window.location.search));

  return (
    <div className="flex h-full flex-col">
      {collapsed ? (
        <CollapsedPill title={showing?.label ?? label} onExpand={() => setCollapsed(false)} />
      ) : (
        <BarFrame
          onCollapsed={setCollapsed}
          lead={<HandoffName />}
          primary={
            <BarSelect
              primary
              label="Screen"
              options={SCREENS}
              value={screen}
              onChange={(s) => {
                setScreen(s);
                setState("default");
              }}
            />
          }
          tail={<HandoffTail screen={screen} open={open} />}
        >
          <BarSelect label="State" options={states} value={current} onChange={setState} sizeTo={ALL_STATES} />
          <ViewportSwitch viewport={viewport} onViewport={setViewport} />
        </BarFrame>
      )}

      <Stage viewport={viewport} className="bg-neutral-50 text-neutral-800">
        {screen === "home" ? <Home quiet={current === "quiet"} /> : null}
        {screen === "orders" ? (
          <Orders
            count={current === "empty" ? 0 : 14}
            phone={viewport === "mobile"}
            onOpen={(id) => {
              setOrder(id);
              setScreen("order");
              setState("default");
            }}
          />
        ) : null}
        {screen === "order" ? <OrderDetail key={`${order}-${current}`} id={order} refunding={current === "refund"} /> : null}
      </Stage>
    </div>
  );
}
