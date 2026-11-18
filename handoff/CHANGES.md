<!--
  What changed after the handoff went to the developers, newest first under the
  version it was made in. Every change ported into the handoff adds an entry in
  the same commit:

  ### A title that says what changed {#an-id-that-never-changes}
  - **Date** 2026-11-18 14:05
  - **Opens** ?screen=orders&state=empty
  - **Impact** What it means for whoever builds it, or "Look only."
  A short paragraph.

  The pack finds the commit that added each `{#id}` and hands the developer's
  agent the files it touched and its diff.
-->

## v1.1

### A refund asks first {#refund-asks}
- **Date** 2026-11-18 15:20
- **Opens** ?screen=order&state=refund
- **Impact** A confirm step before the refund call. The rules are under Refund in the implementation notes.

Refund opens a question naming the amount and who gets it back, with Keep it as the safe way out.

### The empty list says what happens next {#orders-empty}
- **Date** 2026-11-18 15:10
- **Opens** ?screen=orders&state=empty
- **Impact** Look only.

No orders yet now says they show the moment one is placed, instead of an empty table.

## v1.0
