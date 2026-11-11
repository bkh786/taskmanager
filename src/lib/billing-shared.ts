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

/** Amount for one cycle: price (or the tenant's override) plus seats beyond the plan's allowance. */
export function cycleAmount(opts: {
  price: number;
  priceOverride?: number | null;
  includedUsers?: number | null;
  extraUserPrice?: number | null;
  maxUsers?: number | null;
}): number {
  const base = opts.priceOverride ?? opts.price;
  const extraSeats =
    opts.includedUsers != null && opts.maxUsers != null ? Math.max(0, opts.maxUsers - opts.includedUsers) : 0;
  return Math.round((Number(base) + extraSeats * Number(opts.extraUserPrice ?? 0)) * 100) / 100;
}
