import { orders } from "./data";
import { Card, Status, money } from "./ui";

/** Every order, newest first. Empty says what to do, not just that it is empty.
 *  On a phone the total drops off the row; the status stays. */
export function Orders({ count, phone, onOpen }: { count: number; phone: boolean; onOpen: (id: number) => void }) {
  const list = orders(count);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <h1 className="text-[18px] font-semibold text-neutral-900">Orders</h1>
      <Card title={`${list.length} order${list.length === 1 ? "" : "s"}`}>
        {list.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] font-medium text-neutral-800">No orders yet</p>
            <p className="mt-1 text-[13px] text-neutral-500">They show here the moment one is placed.</p>
          </div>
        ) : (
          list.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onOpen(o.id)}
              className="flex w-full cursor-pointer items-center gap-4 border-b border-neutral-100 px-5 py-2.5 text-start text-[13px] last:border-0 hover:bg-neutral-50"
            >
              <span className="w-14 tabular-nums text-neutral-400">#{o.id}</span>
              <span className="flex-1 text-neutral-800">{o.customer}</span>
              {phone ? null : <span className="w-20 text-end tabular-nums text-neutral-700">{money(o.total)}</span>}
              <Status status={o.status} />
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
