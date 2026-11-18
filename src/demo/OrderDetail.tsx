import { useState } from "react";
import { orders } from "./data";
import { Card, Status, money } from "./ui";

/** One order: who, what, and the one action it is waiting on. Refunding asks
 *  first, because it cannot be undone. */
export function OrderDetail({ id, refunding }: { id: number; refunding: boolean }) {
  const order = orders(40).find((o) => o.id === id) ?? orders(1)[0];
  const [asking, setAsking] = useState(refunding);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[18px] font-semibold text-neutral-900">Order #{order.id}</h1>
        <Status status={order.status} />
      </div>
      <Card
        title={order.customer}
        action={
          order.status === "Refunded" ? null : (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="h-8 cursor-pointer rounded-md border border-neutral-300 px-3 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Refund
            </button>
          )
        }
      >
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 px-5 py-4 text-[13px]">
          <dt className="text-neutral-500">Placed</dt>
          <dd className="text-neutral-800">{order.placed}</dd>
          <dt className="text-neutral-500">Total</dt>
          <dd className="tabular-nums text-neutral-800">{money(order.total)}</dd>
        </dl>
      </Card>
      {asking ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setAsking(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[360px] rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-[14px] font-semibold text-neutral-900">Refund {money(order.total)}?</h2>
            <p className="mt-2 text-[13px] text-neutral-500">
              {order.customer} gets it back on the card they paid with. This can’t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAsking(false)} className="h-8 cursor-pointer rounded-md px-3 text-[12px] text-neutral-600 hover:bg-neutral-100">
                Keep it
              </button>
              <button type="button" onClick={() => setAsking(false)} className="h-8 cursor-pointer rounded-md bg-neutral-900 px-3 text-[12px] font-medium text-white">
                Refund
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
