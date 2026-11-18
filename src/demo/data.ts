// Made-up orders for the demo screens. The pack leaves this file out: the
// prototype's data is not the product's (see `handoff.config.ts`).

export interface Order {
  id: number;
  customer: string;
  total: number;
  status: "Open" | "Shipped" | "Refunded";
  placed: string;
}

const NAMES = ["Maya Cohen", "Lior Ben-David", "Noa Levi", "Amit Shapiro", "Yael Katz", "Omer Friedman", "Tamar Golan", "Itai Rosen"];
const STATUSES: Order["status"][] = ["Open", "Shipped", "Open", "Refunded", "Shipped"];

export function orders(count: number): Order[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 1040 + i,
    customer: NAMES[i % NAMES.length],
    total: 48 + ((i * 37) % 260),
    status: STATUSES[i % STATUSES.length],
    placed: `${(i % 27) + 1} Nov`,
  }));
}
