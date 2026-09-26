# Decisions

Newest first.

## 26 Sep 2026 — fixes from the copies brought back; the inbox marks, it does not delete

Seven projects carry a copy. iPlan and snag-website were copied from EDLock, not from here,
and snag-studio fixed its own copy without sending anything back, so this had become the
copy with the most known bugs. Brought back: the notes inbox fixes (snag-studio), notes
around dialogs and the keyboard-language fix (iPlan), the jump to a pin (snag-website),
names on notes, address state, a Next route, and the small ones.

**The dev server marks what it collects instead of deleting it.** Deleting made collected
notes vanish from the public link and lost a "done" ticked there afterwards. The link now
shows the deployed `notes.json` with the inbox laid over it, and a collected entry stops
counting once the server restarts after the collect — a restart is a deploy, and a deploy
brings the repo file. A restart that is not a deploy hides collected notes from the link
until the next one; nothing is lost, they are in the repo.

**The browser is no longer a mirror of every save.** It kept a copy of each note the server
had, and gave notes deleted in the repo back to the server on the next load.

**Saves still send the whole list.** Two reviewers saving within one page load can still
overwrite each other's note (snag-studio sends changes instead). Judged too rare to carry.

**The popover fix went out to EDLock, iPlan and snag-website**, the other direction.

## 16 Sep 2026 — the notes came across whole, addressed by `screen` + `viewport` + `context`

EDLock's note carried the project's own fields — version, state, the answers to open
questions, the chrome mode, which prototype. Here a note is `screen`, `viewport` and a free
`context` map. The first two are the address (a pin measured on a phone means nothing on a
desktop); everything in `context` is recorded for the jump and the list and never filters
a pin. The same rule EDLock arrived at, with the field names left to the job.

**Replies to questions stayed behind.** They were the same record as a note with a `qid`
on it, and the questions menu they live in is the part that did not come across.

**The popover is placed, not flipped.** EDLock flips it left past 55% of the box, which
on a 390px phone frame clips it on either side from the middle. Here it opens right when
that fits, left when that fits, and is otherwise held inside the box's edges.

**The demo's `notes.json` is gitignored; a real job commits it.** The file is the point —
the agent reads it — but a demo's scribbles are not a record of anything.

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
