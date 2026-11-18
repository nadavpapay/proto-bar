// The demo screens' shared parts: a card, a status pill and a money figure.

import type { ReactNode } from "react";
import type { Order } from "./data";

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {title ? (
        <header className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3">
          <h2 className="text-[13px] font-semibold text-neutral-800">{title}</h2>
          <div className="ms-auto">{action}</div>
        </header>
      ) : null}
      {children}
    </section>
  );
}

const TONE: Record<Order["status"], string> = {
  Open: "bg-sky-50 text-sky-700",
  Shipped: "bg-emerald-50 text-emerald-700",
  Refunded: "bg-neutral-100 text-neutral-500",
};

export function Status({ status }: { status: Order["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[status]}`}>{status}</span>;
}

export const money = (n: number) => `$${n.toFixed(2)}`;
