# proto-bar

The builder chrome from the EDLock prototypes, pulled out so any clickable prototype can
wear it: a dark, LTR bar over the stage with a screen picker, whatever pickers the job
needs, a review group on the right, and a hide button that collapses the whole thing to a
draggable corner pill.

Nothing in it knows what project it is in. There is no router, no notes system, no
versions — those were EDLock's and stay there. What you get is the frame and the controls;
what goes in the slots is yours.

```bash
cd ~/dev/proto-bar && npm run dev      # the demo, port 4710
```

## Using it in a project

Copy `src/parts.tsx`, `src/CollapsedPill.tsx`, `src/index.ts` and `src/tokens.css` into
the project. It needs **React 19** and **Tailwind v4** — the tokens file is an `@theme`
block, imported once after `@import "tailwindcss";`:

```css
@import "tailwindcss";
@import "./proto-bar/tokens.css";
```

Then compose a bar. `src/Example.tsx` is a whole one; the shape is:

```tsx
<BarFrame
  caption="Acme redesign"                       // hidden under 1600px
  lead={<Segments … />}                         // optional — a prototype switch, a logo
  leadCompact={<Segments … />}                  // what lead becomes on a phone
  primary={<BarSelect primary label="Screen" options={SCREENS} value={screen} onChange={setScreen} />}
  tail={<><ModeButton … /><ReadyMark ready={…} /></>}   // the review group, flush right
  onCollapsed={setCollapsed}
>
  <BarSelect label="Version" … />               // everything about what is on the stage
  <ViewportSwitch viewport={viewport} onViewport={setViewport} />
  <BarSelect label="State" … />
</BarFrame>
```

When `collapsed`, render `<CollapsedPill title={…} onExpand={…} />` instead, and wire `\`
with `useBarKeys({ "\\": () => setCollapsed(c => !c) })`. Make the stage under the bar
`flex-1 min-h-0` so it gives up the bar's second row when the bar wraps.

## What is in the box

| Piece | What it is |
|---|---|
| `BarFrame` | The header. Four slots — `lead`, `primary`, `children`, `tail` — then the hide button. Wraps rather than overflows; on a phone it is one row and a ⋯ tray. |
| `BarSelect` | A picker. Native `<select>` laid transparently over a label that is already as wide as its longest option, so the pick changing moves nothing. `primary` fills it. |
| `Segments` / `Segment` | A segmented control for a choice small enough to show whole. |
| `ViewportSwitch` | Desktop / mobile, on `Segments`. |
| `ModeButton` | A bordered toggle that is visibly on, for a builder page shown instead of a screen. Four hues so two in a row can be told apart. |
| `ReadyMark` | "Nothing open here" — a statement, not a control. Always present, lit green or faded back, so the bar's end never moves. |
| `Widest` | The width trick behind `BarSelect`: every possible label stacked invisibly under the live one. |
| `CollapsedPill` | The bar minimised: draggable, remembers where it was put, click reopens. |
| `useBarKeys` | Single-key shortcuts, ignored while typing. |
| `usePhone` / `PHONE_PANEL` | The 640px line, as a hook and as the classes a menu panel wears to sit under the bar on a phone. |
| `trigger` / `triggerPrimary` / `iconBtn` | The three class strings every control is built from, for anything you add. |

## The rules it keeps

- **The bar does not move when the screen does.** Every control is `shrink-0` and every
  label that changes per screen sits on `Widest`. A control you put in the tail that
  carries a counter should reserve room for its widest count the same way.
- **It never runs off the window.** A row that does not fit wraps; the tail drops whole
  onto a second row and sits flush right. A bar that pushes the page wider scrolls the
  document sideways under the prototype, which is the one thing chrome must never do.
- **Builder chrome is not product.** `ui-*` tokens only, LTR whatever the stage is, never
  themed by the thing under it. Nothing the stage draws should be able to pass for the
  bar, or the other way round.
- **The pill stays where the button was.** Hide and show swap a 28px control in the same
  spot; nothing appears to jump.

## Not included, on purpose

The notes layer (pins on the screen, a menu counting them), the open-questions menu and
the saved-versions picker are EDLock's — each is wired to a store and a screen registry
that would come along with it. They are what the `tail` slot is for. When one of them is
wanted a second time, that is the day to lift it out.
