# proto-bar

The builder chrome from the EDLock prototypes, pulled out so any clickable prototype can
wear it: a dark, LTR bar over the stage with a screen picker, whatever pickers the job
needs, a review group on the right, and a hide button that collapses the whole thing to a
draggable corner pill.

Plus the review notes: pins dropped on the screen with a sentence each, saved to a file in
the repo so the agent reads them on "look at the notes", collected off the public link when
there is one.

Nothing in it knows what project it is in. There is no router and no screen registry —
what goes in the slots is yours.

```bash
cd ~/dev/proto-bar && npm run dev      # the demo, port 4710
```

## Using it in a project

Copy `src/` (minus `main.tsx`, `demo.css` and `Example.tsx`) into the project, and for
the notes `vite-notes.ts` + `notes-sync.ts` beside `vite.config.ts` (or `next-notes.ts` +
`notes-sync.ts` in a Next app — see below). It needs **React 19** and **Tailwind v4** — the
tokens file is an `@theme` block, imported once after `@import "tailwindcss";`:

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
with `useBarKeys({ "\\": () => setCollapsed(c => !c) })`. Bind a different key and pass it
as `hideKey` to both `BarFrame` and `CollapsedPill`, so their tooltips name it. Keys work
whatever language the keyboard is in. Put the screen in a `Stage` (desktop fills the
window, mobile is a real 390×844 frame) — or your own `flex-1 min-h-0 relative` box, so it
gives up the bar's second row when the bar wraps.

If the page has a sticky header of its own, give it `top: var(--proto-bar-h, 0px)`: the
bar keeps that variable at its own height, and 0px while it is hidden.

**State in the address.** `useUrlState(key, fallback, allowed)` is `useState` kept in the
query string, so a link opens the same screen, viewport and state. It touches only its own
key. `Example.tsx` keeps `screen`, `version`, `v`, `state` and `notes` there, and starts the
viewport on `mobile` when the link is opened on a phone.

### Notes

Three parts, all in `src/notes/`, and one dev-server plugin:

```ts
// vite.config.ts
import { notesFile } from "./vite-notes.ts";
plugins: [react(), tailwindcss(), notesFile()]          // writes notes.json in the repo
```

```tsx
const { notes, write, where } = useNotesStore();        // the whole file; { route } if not /__notes
const here = notes.filter(n => n.screen === screen && n.viewport === viewport);
const openHere = here.filter(n => !n.done);

// in the bar's tail
<NotesMenu notes={notes} here={openHere.length} hereAll={here.length}
  on={notesOn} onToggle={…} showDone={…} onShowDone={…} where={where} onJump={…} />

// over the stage
<Stage viewport={viewport} overlay={notesOn && (
  <NotesLayer notes={showDone ? here : openHere}
    where={{ screen, viewport, context: { version, state } }}
    onAdd={n => write([...notes, n])} onEdit={…} onToggle={…} onDelete={…} newId={newId} />
)}>
```

Wire `n` in `useBarKeys` to toggle the layer. `Example.tsx` has all of it, including the
jump back to where a note was written: set the screen, then pass the note's id as the
layer's `focus` and it scrolls the pin into view and opens it.

A note records the screen and viewport it was dropped on and shows only there; whatever
else you put in `context` (a version, a state) is written down for the jump and the list
but never hides a pin. A dialog that carries `data-note-scope="name"` gets its own notes,
measured against its own box and drawn only while it is open. Hold ⌥ to click through the
layer to the screen (`hint={false}` drops the reminder; phones never show it). Done notes
stay in the file, off the screen. The first note someone writes asks their name; it is
remembered in that browser and shown with the date on every note.

**Where notes go.** On the dev server, `notes.json` in the repo — commit it, it is the
record. On a deployed copy (`server.cjs`, a static server with a `/__notes` inbox that
survives redeploys on a `/data` volume), what reviewers do lands in the inbox, and the link
shows the deployed `notes.json` with the inbox laid over it. The dev server collects the
inbox the next time it runs, given `notesFile({ inbox: "https://…/__notes" })` — new notes,
edits, "done" and deletes alike — and the link keeps showing them until the next deploy
brings the repo file that has them. With no endpoint at all they live in the browser and
the panel says so, with Copy all as the way out. The rules are in `notes-sync.ts`.

**In a Next app**, the same endpoint is a route:

```ts
// app/api/notes/route.ts
import { notesRoute } from "@/proto-bar/next-notes";
export const { GET, POST } = notesRoute({ file: "notes.json", inbox: "https://…/api/notes" });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Under `next dev` it writes the repo file; in production it is the inbox. Point the page at
it with `useNotesStore({ route: "/api/notes" })`, and name the file in the panel with
`<NotesMenu file="notes.json" …/>`.

**Dialogs in the app.** A modal dialog blocks every click on itself, so notes can't be
written on it, and it closes when you press the bar. `useNotesMode()` says when the notes
layer is up and `isChrome(target)` says a press landed on the chrome. Make the dialog
non-modal while notes are on, and don't let a chrome press count as "outside":

```tsx
const notes = useNotesMode();
<Dialog modal={!notes}>
  <DialogContent onInteractOutside={(e) => isChrome(e.detail.originalEvent.target) && e.preventDefault()}>
```

Dialogs rendered at the end of the page (most libraries do) are found wherever they are.

### Working the notes

- **A fix marks its note done in the same commit, and says so** — "Closes notes 3 and 5."
  Only a note that was actually built gets marked; a question, or anything not done yet,
  stays open.
- **Collecting the live inbox never deletes anything that holds a status.** Notes move
  into the repo; a mark the live link is still reading (a "ready" mark, say) must not be
  wiped by the collect. The inbox marks what it hands over rather than deleting it for
  this reason.

## What is in the box

| Piece | What it is |
|---|---|
| `BarFrame` | The header. Four slots — `lead`, `primary`, `children`, `tail` — then the hide button. Wraps rather than overflows; on a phone it is one row and a ⋯ tray. |
| `BarSelect` | A picker. Native `<select>` laid transparently over a label that is already as wide as its longest option, so the pick changing moves nothing. `primary` fills it; `sizeTo` sizes it to other lists it can switch to. |
| `Segments` / `Segment` | A segmented control for a choice small enough to show whole. `showLabel` says what it is for inside it. |
| `ViewportSwitch` | Desktop / mobile, on `Segments`. |
| `ModeButton` | A bordered toggle that is visibly on, for a builder page shown instead of a screen. Four hues so two in a row can be told apart. |
| `ReadyMark` | "Nothing open here" — a statement, not a control. Always present, lit green or faded back, so the bar's end never moves. |
| `Widest` | The width trick behind `BarSelect`: every possible label stacked invisibly under the live one. |
| `CollapsedPill` | The bar minimised: draggable, remembers where it was put, click reopens. |
| `Stage` | Everything under the bar: desktop fills, mobile is a 390×844 frame, on a phone the frame is the window. `overlay` is where the notes layer goes. |
| `NotesMenu` | The bar's notes control: a toggle with the open count, and the list of every note with a jump back to each. |
| `NotesLayer` | The pins, the composer, the ⌥ pass-through, the overlay scoping. |
| `useNotesStore` / `notesStore` | The whole file as state, and where it is being kept. `route` for a server elsewhere. |
| `vite-notes.ts` / `next-notes.ts` / `server.cjs` | The notes servers: Vite dev, a Next route (dev and deployed), a deployed static site. `notes-sync.ts` holds the rules they share. |
| `useNotesMode` / `isChrome` / `chrome` | For the app's own dialogs: is the notes layer up, and did a press land on the chrome. |
| `useUrlState` | `useState` kept in the query string, one key each. |
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

The open-questions menu (answer an open question both ways from the bar, with replies
filed against it) and the saved-versions picker are EDLock's — each is wired to a screen
registry that would come along with it. They are what the `tail` slot is for. When one is
wanted a second time, that is the day to lift it out.
