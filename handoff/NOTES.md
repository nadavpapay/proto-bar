<!--
  The implementation notes: what the prototype can't show. One `## Title {#id}`
  section per rule. A screen's brief carries the sections its `notes` name in
  handoff.config.ts; `everywhere` and `fakes` go into AGENTS.md. The bar opens
  this at the screen on the page.
-->

# Shop admin · Implementation notes

## Everywhere {#rules}

- Money is shown with two decimals and the currency sign, from one helper. Never format it inline.
- Times are the shop's time zone, not the browser's.
- An order number is the order's id with `#` before it. Nothing else is shown as its name.

## What the prototype fakes {#fakes}

Every order is made up in `src/demo/data.ts`, which is left out of the pack. Counts, names and totals come from the shop's own data; nothing in the prototype is a rule about them.

## Home {#home}

- "Waiting to ship" counts open orders placed before today's cut-off. After the cut-off they count toward tomorrow.
- "Needs a hand" shows at most four. The rest are a click away on Orders.

## Orders {#orders}

- Newest first. The list loads 50 at a time as it scrolls.
- On a phone the total drops off the row; the status never does.

## Order detail {#order}

- The status pill is the order's status as the shop sees it, not the payment's.

### Refund {#refund}

- Refund asks first, because it cannot be undone. The question names the amount and who gets it back.
- A refunded order has no Refund button.
