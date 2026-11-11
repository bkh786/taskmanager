// Billing vocabulary shared by server and client code.

export const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly", months: 1 },
  { value: "quarterly", label: "Quarterly", months: 3 },
  { value: "semi_annual", label: "Semi-annual", months: 6 },
  { value: "annual", label: "Annual", months: 12 },
  { value: "one_time", label: "One-time", months: 0 },
] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number]["value"];

export function isBillingCycle(v: string | null | undefined): v is BillingCycle {
  return BILLING_CYCLES.some((c) => c.value === v);
}

export function cycleLabel(v: string | null | undefined): string {
  return BILLING_CYCLES.find((c) => c.value === v)?.label ?? "—";
}

export const PAYMENT_STATUSES = [
  { value: "trial", label: "Trial" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function paymentLabel(v: string | null | undefined): string {
  return PAYMENT_STATUSES.find((p) => p.value === v)?.label ?? "—";
}

/** Days between an invoice being issued and it falling overdue. */
export const INVOICE_DUE_DAYS = 7;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO date + N calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsIso(iso: string, months: number): string {
  const d = parseIso(iso);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return toIso(t);
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Start of the cycle that follows the one beginning at `startIso`; null for one-time plans. */
export function nextCycleStart(startIso: string, cycle: string | null | undefined): string | null {
  const months = BILLING_CYCLES.find((c) => c.value === cycle)?.months ?? 0;
  return months > 0 ? addMonthsIso(startIso, months) : null;
}

export function formatMoney(amount: number | string | null | undefined, currency = "INR"): string {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export type Discounts = { quarterly: number; semi_annual: number; annual: number };
export const DEFAULT_DISCOUNTS: Discounts = { quarterly: 8, semi_annual: 12, annual: 20 };

export function cycleMonths(cycle: string | null | undefined): number {
  return BILLING_CYCLES.find((c) => c.value === cycle)?.months ?? 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Price of a plan for one billing cycle. Monthly and one-time prices are
 * entered; the longer cycles are monthly x months x (1 - discount%).
 * Null when the plan has no price for that cycle (e.g. no one-time price).
 */
export function planCyclePrice(
  plan: { price: number | string; one_time_price?: number | string | null },
  cycle: string | null | undefined,
  discounts: Discounts
): number | null {
  const monthly = Number(plan.price);
  switch (cycle) {
    case "monthly":
      return monthly;
    case "one_time":
      return plan.one_time_price == null ? null : Number(plan.one_time_price);
    case "quarterly":
      return round2(monthly * 3 * (1 - discounts.quarterly / 100));
    case "semi_annual":
      return round2(monthly * 6 * (1 - discounts.semi_annual / 100));
    case "annual":
      return round2(monthly * 12 * (1 - discounts.annual / 100));
    default:
      return null;
  }
}

/** Plan + cycle combinations a tenant can be put on ("Starter - Monthly", ...). */
export function planChoices<P extends { id: string; name: string; price: number | string; one_time_price?: number | string | null; currency: string }>(
  plans: P[],
  discounts: Discounts
) {
  const out: { value: string; label: string; plan: P; cycle: BillingCycle; price: number }[] = [];
  for (const plan of plans) {
    for (const c of BILLING_CYCLES) {
      const price = planCyclePrice(plan, c.value, discounts);
      if (price === null) continue;
      out.push({ value: `${plan.id}|${c.value}`, label: `${plan.name} - ${c.label}`, plan, cycle: c.value, price });
    }
  }
  return out;
}

/** Amount for one cycle: the cycle price (or the tenant's override) plus seats beyond the plan's allowance, charged per month of the cycle. */
export function cycleAmount(opts: {
  cyclePrice: number;
  priceOverride?: number | null;
  includedUsers?: number | null;
  extraUserPrice?: number | null;
  maxUsers?: number | null;
  cycle?: string | null;
}): number {
  const base = opts.priceOverride ?? opts.cyclePrice;
  const extraSeats =
    opts.includedUsers != null && opts.maxUsers != null ? Math.max(0, opts.maxUsers - opts.includedUsers) : 0;
  const months = Math.max(1, cycleMonths(opts.cycle));
  return round2(Number(base) + extraSeats * Number(opts.extraUserPrice ?? 0) * months);
}
