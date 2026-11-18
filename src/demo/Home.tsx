import { orders } from "./data";
import { Card, money } from "./ui";

/** The day at a glance: three figures and what needs a hand. */
export function Home({ quiet }: { quiet: boolean }) {
  const list = orders(quiet ? 0 : 12);
  const open = list.filter((o) => o.status === "Open");
  const figures = [
    { label: "Orders today", value: String(list.length) },
    { label: "Waiting to ship", value: String(open.length) },
    { label: "Taken", value: money(list.reduce((s, o) => s + o.total, 0)) },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <h1 className="text-[18px] font-semibold text-neutral-900">Good morning</h1>
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {figures.map((f) => (
          <Card key={f.label}>
            <div className="px-5 py-4">
              <p className="text-[12px] text-neutral-500">{f.label}</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-neutral-900">{f.value}</p>
            </div>
          </Card>
        ))}
      </div>
      <Card title="Needs a hand">
        {open.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-neutral-500">Nothing waiting. A quiet day.</p>
        ) : (
          open.slice(0, 4).map((o) => (
            <div key={o.id} className="flex gap-4 border-b border-neutral-100 px-5 py-2.5 text-[13px] last:border-0">
              <span className="w-14 tabular-nums text-neutral-400">#{o.id}</span>
              <span className="flex-1 text-neutral-800">{o.customer}</span>
              <span className="text-neutral-500">Ship by tomorrow</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
