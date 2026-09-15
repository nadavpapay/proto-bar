// ─── What a prototype bar is made of ──────────────────────────────────────────
//
// Builder chrome, not product. Deliberately LTR and dark whatever the stage
// under it is doing — the person driving the bar and the person looking at what
// is under it must never mistake one for the other. It uses only the `ui-*`
// token layer (see `tokens.css`) for the same reason.
//
// Collapses to a corner pill (the hide button, or `\`) so the drawing gets the
// whole viewport at 100%, which is the point of previewing in a browser rather
// than in a Figma frame.
//
// THE BAR DOES NOT MOVE WHEN THE SCREEN DOES. Every control keeps the same width
// and the same place on every screen, because a control that slides sideways
// under the cursor when you change page is a control you have to re-find each
// time. Two things make that true:
//   · text that changes per screen is laid over `Widest`, so the button is
//     already as wide as its longest possible label and the label swap moves
//     nothing;
//   · anything that carries a counter reserves its own room rather than
//     growing when the count does — see `ReadyMark`, and do the same in any
//     menu you put in the tail.

import { useEffect, useRef, useState, type ReactNode } from "react";

// ─── Trigger styles ───────────────────────────────────────────────────────────
//
// Three looks, one height. Compose them: `${trigger} relative` for a select
// laid over a label, and so on. Kept as strings rather than components so a
// <label>, a <button> and a <Link> can all wear the same box.

/** The ordinary bordered pill. */
export const trigger =
  "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-ui-line/70 bg-transparent px-2.5 text-[11px] font-medium text-ui-text transition-colors hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-dim";

/** Filled — the one control that names where you are. */
export const triggerPrimary =
  "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-ui-line bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text transition-colors hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-dim";

/** A square for one icon. */
export const iconBtn =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ui-dim transition-colors hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-dim";

// ─── Keys ─────────────────────────────────────────────────────────────────────

/** Single-key shortcuts for the bar. `\` hides the chrome by convention; add
 *  whatever else the bar toggles (`n` for a notes layer, say). Ignored while
 *  typing and under any modifier, so nothing fires from a field inside a
 *  drawing. Keys are matched case-insensitively. */
export function useBarKeys(keys: Record<string, () => void>) {
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (!fn) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
        return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// ─── Phone ────────────────────────────────────────────────────────────────────

/** The window is a phone — under the `sm` breakpoint, 640px, the same line the
 *  `max-sm:` classes are drawn at. A hook and not a class because the bar does
 *  not just restyle on a phone, it puts different things in different places
 *  (see `BarFrame`), and a control drawn twice with one copy hidden is two
 *  selects, two menus and two sets of keys.
 *
 *  This is about the WINDOW, not the stage: a viewport switch on the bar says
 *  which layout the prototype draws; this says which device it is looked at on. */
export function usePhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(PHONE).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
const PHONE = "(max-width: 639px)";

/** How a menu's panel sits on a phone: fixed to the window, the window's width
 *  less a 12px gutter, under the bar's 44px row — instead of hanging off its
 *  trigger, which on a phone is somewhere in the tray. Give it to every panel
 *  the bar opens, so they all land in the same place. */
export const PHONE_PANEL =
  "max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[52px] max-sm:mt-0 max-sm:w-auto";

// ─── The frame ────────────────────────────────────────────────────────────────

/**
 * The header itself.
 *
 * Four slots, left to right: `lead` (a caption and, if you have one, the
 * control that switches between prototypes), `primary` (the one control that
 * names where you are — the screen picker), `children` (everything about
 * what is on the stage: viewport, state, version) and `tail` (everything
 * about the review of it: counters, modes, a ready mark). The hide button is
 * drawn last, after the tail, in both layouts.
 *
 * IT NEVER RUNS OFF THE WINDOW. Every control is shrink-0, so a row that does
 * not fit cannot squeeze; it wraps instead. The tail carries `ms-auto`, so on
 * a window too narrow for one row it drops whole onto a second and sits flush
 * right: what is on the stage on the first line, the review controls on the
 * second. A fixed-height row would push the page wider and scroll the document
 * sideways under the prototype — the one thing chrome must never do to the
 * thing it is framing. `min-h-11` with 8px of padding is 44px on one row; make
 * the stage under it `flex-1` and it gives up the second row's height.
 *
 * The caption is hidden under 1600px rather than truncated: every other
 * control is shrink-0 too, so a shrinkable title would absorb the entire
 * squeeze and collapse to four letters while nothing else gave an inch. It is
 * the one thing here that is not a control, so it is what gives way.
 *
 * ON A PHONE — under 640px — it is a different arrangement, not a narrower
 * one: one row and a tray. The row keeps `lead` (pass `compact` versions of
 * anything wide) and `primary`, plus a ⋯ button; `children` and `tail` flow in
 * a tray that drops from the row, full width. The tray closes on a press
 * outside it — NOT on Escape, because the menus inside it close on Escape one
 * level at a time, and a tray that closed on the same key would take a
 * half-closed menu down with it.
 */
export function BarFrame({
  caption,
  lead,
  leadCompact,
  primary,
  children,
  tail,
  onCollapsed,
}: {
  /** The job's name and nothing more. Shown from 1600px up. */
  caption?: string;
  /** Sits before the primary control on every width — a prototype switch, a
   *  logo. Nothing here is fine. */
  lead?: ReactNode;
  /** What `lead` becomes on a phone, where the row has ~360px for everything.
   *  Defaults to `lead`. */
  leadCompact?: ReactNode;
  /** The one control that names where you are. On a phone it is the one
   *  control that stays on the row. */
  primary: ReactNode;
  /** Everything about what is on the stage — viewport, state, the pickers. */
  children?: ReactNode;
  /** The review group on the right — counters, modes, the ready mark. */
  tail?: ReactNode;
  onCollapsed: (c: boolean) => void;
}) {
  const phone = usePhone();
  const [tray, setTray] = useState(false);
  const box = useRef<HTMLElement>(null);

  // The tray goes away with the phone layout, so a window widened past 640px
  // does not keep an invisible tray open.
  useEffect(() => {
    if (!phone) {
      setTray(false);
      return;
    }
    if (!tray) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setTray(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [tray, phone]);

  if (phone) {
    return (
      <header
        ref={box}
        dir="ltr"
        className="relative z-[60] flex h-11 shrink-0 items-center gap-2 border-b border-ui-line/70 bg-ui-surface px-3"
      >
        {leadCompact ?? lead}
        {primary}
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setTray(!tray)}
            aria-expanded={tray}
            aria-label="More controls"
            title="More controls"
            className={`${iconBtn} ${tray ? "bg-ui-raised text-ui-text" : ""}`}
          >
            <Dots />
          </button>
          <BarTail onCollapsed={onCollapsed} />
        </div>
        {tray ? (
          <div className="absolute inset-x-0 top-full z-[60] flex flex-wrap items-center gap-2 border-b border-ui-line/70 bg-ui-surface px-3 py-3 shadow-2xl">
            {children}
            {/* A hairline between what is on the stage and what is said about
                it, once the two are in one flow — the desktop row separates
                them with the whole width of the bar. */}
            {children && tail ? <span className="basis-full border-t border-ui-line/70" /> : null}
            {tail}
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header
      dir="ltr"
      // z-[60], above anything a drawing puts on its own stage: a modal at z-50
      // must not paint over a menu the bar opens about it.
      className="sticky top-0 z-[60] flex min-h-11 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-ui-line/70 bg-ui-surface px-4 py-2 min-[1440px]:gap-x-3"
    >
      {caption ? (
        <>
          <span className="hidden shrink-0 text-[11px] font-medium text-ui-dim min-[1600px]:inline">
            {caption}
          </span>
          <span className="mx-1 hidden h-4 w-px shrink-0 bg-ui-line min-[1600px]:block" />
        </>
      ) : null}
      {lead}
      {lead ? <span className="mx-1 h-4 w-px shrink-0 bg-ui-line" /> : null}
      {primary}
      {children}
      <div className="ms-auto flex shrink-0 items-center gap-2 ps-2">
        {tail}
        <BarTail onCollapsed={onCollapsed} />
      </div>
    </header>
  );
}

function Dots() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="currentColor" aria-hidden>
      <circle cx="3.5" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="12.5" cy="8" r="1.4" />
    </svg>
  );
}

/** Hide the bar. The last control, in the same place on every bar, because it
 *  is the one that has nothing to do with what is on the stage. */
export function BarTail({ onCollapsed }: { onCollapsed: (c: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCollapsed(true)}
      title="Hide the bar  (\)"
      aria-label="Hide the bar"
      className={iconBtn}
    >
      <Chevron />
    </button>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

/** A label that has already made room for the longest thing it could say.
 *
 *  Every option is drawn stacked in the same grid cell and all but the live one
 *  is `invisible` — so the box is as wide as the widest of them and swapping
 *  which one shows moves nothing. A hardcoded width would do the same job until
 *  somebody adds a longer name, and then it would truncate silently.
 *
 *  `invisible` rather than `hidden`: a hidden element is not laid out and so
 *  contributes no width, which is the whole point of the ones underneath. */
export function Widest({
  all,
  className = "",
  children,
}: {
  all: string[];
  /** Anything that changes the metrics — weight, tabular figures — belongs here
   *  rather than on the child, or the ghosts underneath are measured in a
   *  different face from the label on top of them. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`grid ${className}`}>
      {all.map((t) => (
        <span key={t} aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {t}
        </span>
      ))}
      <span className="col-start-1 row-start-1 whitespace-nowrap">{children}</span>
    </span>
  );
}

export interface BarOption {
  id: string;
  label: string;
  /** What the native menu shows for this row, when it should say more than the
   *  trigger does — "Users — not drawn yet". Defaults to `label`. */
  menu?: string;
}

/** A picker: a trigger showing the current option's label, with the native
 *  <select> laid transparently over it.
 *
 *  Laid over rather than styled directly, because a bare <select> sizes itself
 *  to its WIDEST option and would set the width of every trigger after it. The
 *  label sits on `Widest`, so the trigger is already as wide as its longest
 *  option and changing the pick moves nothing.
 *
 *  This is builder chrome, so the browser's own menu is fine here — the rule
 *  that nothing native is shown belongs to the stage under the bar, not the bar. */
export function BarSelect({
  options,
  value,
  onChange,
  label,
  primary = false,
  className = "",
  title,
}: {
  options: BarOption[];
  value: string;
  onChange: (id: string) => void;
  /** For the screen reader. */
  label: string;
  /** Filled rather than bordered — for the one control that names where you are. */
  primary?: boolean;
  /** Extra classes for the label's metrics — `tabular-nums`, `text-ui-dim`. */
  className?: string;
  title?: string;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <label className={`${primary ? triggerPrimary : trigger} relative`} title={title}>
      <Widest all={options.map((o) => o.label)} className={className}>
        {current?.label ?? value}
      </Widest>
      <Chevron />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.menu ?? o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One side of a segmented control. */
export function Segment({
  active,
  onClick,
  children,
  /** The whole control is unavailable — greyed, and it says nothing on hover. */
  dim = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={dim && !active}
      className={`flex h-6 shrink-0 items-center rounded px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-dim ${
        dim ? "cursor-default opacity-40" : "cursor-pointer"
      } ${active ? "bg-ui-raised text-ui-text" : `text-ui-dim ${dim ? "" : "hover:text-ui-text"}`}`}
    >
      {children}
    </button>
  );
}

/** A segmented control — two or three options, all visible, one lit. For a
 *  choice small enough to show whole: desktop / mobile, before / after. Past
 *  three, use `BarSelect`. */
export function Segments({
  options,
  value,
  onChange,
  label,
  dim = false,
}: {
  options: BarOption[];
  value: string;
  onChange: (id: string) => void;
  /** For the screen reader. */
  label: string;
  dim?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-ui-line/70 p-px"
    >
      {options.map((o) => (
        <Segment key={o.id} active={value === o.id} onClick={() => onChange(o.id)} dim={dim}>
          {o.label}
        </Segment>
      ))}
    </div>
  );
}

export type Viewport = "desktop" | "mobile";

/** Desktop / mobile. On a job with wide data tables this is the hardest
 *  question there is, so it earns a permanent control. */
export function ViewportSwitch({
  viewport,
  onViewport,
}: {
  viewport: Viewport;
  onViewport: (v: Viewport) => void;
}) {
  return (
    <Segments
      label="Viewport"
      value={viewport}
      onChange={(v) => onViewport(v as Viewport)}
      options={[
        { id: "desktop", label: "Desktop" },
        { id: "mobile", label: "Mobile" },
      ]}
    />
  );
}

/** A bordered toggle that is visibly ON — for a builder page shown INSTEAD of
 *  a screen (a page map, a data model), where you must be able to see which
 *  mode you left on. Give each one its own `hue`, because two lit toggles in
 *  a row that look alike tell you nothing about which is which. */
export function ModeButton({
  on,
  onClick,
  children,
  title,
  hue = "emerald",
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  hue?: "emerald" | "sky" | "amber" | "violet";
}) {
  const lit = {
    emerald: "border-emerald-400/60 bg-emerald-400/15 text-emerald-200",
    sky: "border-sky-400/60 bg-sky-400/15 text-sky-200",
    amber: "border-amber-400/60 bg-amber-400/15 text-amber-200",
    violet: "border-violet-400/60 bg-violet-400/15 text-violet-200",
  }[hue];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
        on ? lit : "border-ui-line/70 text-ui-text hover:bg-ui-raised"
      }`}
    >
      {children}
    </button>
  );
}

/** Nothing is open on this screen.
 *
 *  A statement, not a control: no border, no hover, nothing to press. The tail
 *  is bordered pills in a row and one more would read as a toggle somebody
 *  forgot to switch off.
 *
 *  DRAWN OFF RATHER THAN HIDDEN WHEN THE SCREEN IS NOT READY. It has to hold
 *  its place either way, or the hide button travels sideways between a settled
 *  screen and a busy one — but an empty gap on the end of a full bar reads as
 *  something that failed to load. So the mark is always there, lit green when
 *  settled and otherwise faded far enough back that it cannot be misread as a
 *  claim. Faded, it is unreadable to a screen reader and says nothing on
 *  hover, because it is not making a statement yet.
 *
 *  THE TOOLTIP SAYS WHICH ZERO THIS IS. A screen whose notes were all written
 *  and all closed is finished; a screen nobody has written on yet only looks
 *  like it. Pass a `title` that tells them apart. */
export function ReadyMark({
  ready,
  title,
  children = "Ready",
}: {
  ready: boolean;
  /** Shown on hover only while lit. */
  title?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden={!ready}
      title={ready ? title : undefined}
      className={`flex h-7 shrink-0 items-center gap-1 px-1 text-[11px] font-medium ${
        ready ? "text-emerald-300" : "text-ui-dim opacity-25"
      }`}
    >
      <Tick />
      {children}
    </span>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.4 8.2 7.2 10l3.4-3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3 shrink-0 text-ui-dim ${className}`} fill="none" aria-hidden>
      <path
        d="M4 6.5 8 10.5 12 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
