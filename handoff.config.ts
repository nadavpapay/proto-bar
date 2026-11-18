// The demo's handoff: three screens of a made-up shop. Copy this file to the
// root of a project and replace everything in it — see "Handoff" in the README.

import { defineHandoff } from "./src/handoff/config.ts";

export default defineHandoff({
  name: "Shop admin",
  slug: "shop",
  version: "1.1",
  // Where the built handoff page is deployed. The pack sits beside it.
  address: process.env.HANDOFF_ADDRESS ?? "http://localhost:4710/handoff/",
  repo: "nadavpapay/proto-bar",
  notes: "handoff/NOTES.md",
  changes: "handoff/CHANGES.md",
  product: "handoff/PRODUCT.md",
  everywhere: ["rules"],
  fakes: "fakes",
  shared: ["src/demo/ui.tsx"],
  source: {
    // The made-up orders are the prototype's, not the product's.
    skip: /^src\/demo\/data\.ts$/,
    assets: ["package.json"],
  },
  screens: {
    home: {
      title: "Home",
      files: ["src/demo/Home.tsx"],
      notes: ["home"],
      states: [
        { label: "A busy morning", query: "?screen=home" },
        { label: "A quiet day", query: "?screen=home&state=quiet", note: "No orders yet today" },
      ],
    },
    orders: {
      title: "Orders",
      files: ["src/demo/Orders.tsx"],
      notes: ["orders"],
      states: [
        { label: "A full list", query: "?screen=orders" },
        { label: "No orders yet", query: "?screen=orders&state=empty" },
        { label: "On a phone", query: "?screen=orders&v=mobile", note: "The total drops off; the status stays" },
      ],
    },
    order: {
      title: "Order detail",
      files: ["src/demo/OrderDetail.tsx"],
      notes: ["order", "refund"],
      states: [
        { label: "An open order", query: "?screen=order" },
        { label: "Asking before a refund", query: "?screen=order&state=refund" },
      ],
    },
  },
});
