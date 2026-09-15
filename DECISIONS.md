# Decisions

Newest first.

## 15 Sep 2026 — lifted out of EDLock as a copy-in, not a package

The bar from `~/dev/edlock/src/proto/bar/` is wanted on other jobs, so it lives here
with everything EDLock-shaped removed: the router (the prototype switch was a `Link`),
the frozen-versions logic, the notes and questions menus, the alert-model segment. What
is left is the frame, the width trick, the controls, the pill and the keys.

**Copy-in rather than an npm package**, the same way `~/dev/design-system` lands in a
project as a vendored copy. A prototype repo is short-lived and the bar gets bent to the
job; a dependency would have to be versioned for every bend. Copy four files, edit them
there, and bring a good change back here by hand.

**Generic slots instead of generic components.** `BarFrame` got `lead` / `leadCompact` /
`primary` / `children` / `tail` rather than props for a switch, a caption, a screen picker.
The EDLock bars had ~30 props each, and nearly all of them were the project's; the frame
only ever cared about where things sit.

**The native `<select>` stays.** EDLock's rule that nothing browser-drawn is shown applies
to the stage, not the chrome. A drawn dropdown for the bar is a `BACKLOG.md` line.

**Not moved into `~/dev/design-system`.** The kit's rule is no literal values, every
declaration a `--t-*` token, themeable. The bar is the opposite by design — one fixed dark
look, Tailwind classes, never themed. It would break the kit's checker on day one.
