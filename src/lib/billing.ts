import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/task-status";
import { sendPlatformEvent } from "@/lib/platform-email";
import {
  INVOICE_DUE_DAYS,
  addDaysIso,
  cycleAmount,
  cycleLabel,
  formatMoney,
  isBillingCycle,
  nextCycleStart,
  planCyclePrice,
  DEFAULT_DISCOUNTS,
  type Discounts,
} from "@/lib/billing-shared";
import type { Tables } from "@/types/database.types";

/** Platform-wide discounts for the longer billing cycles. */
export async function loadDiscounts(): Promise<Discounts> {
  const { data } = await createAdminClient().from("billing_settings").select("*").eq("id", 1).maybeSingle();
  return data
    ? { quarterly: Number(data.discount_quarterly), semi_annual: Number(data.discount_semi_annual), annual: Number(data.discount_annual) }
    : DEFAULT_DISCOUNTS;
}

type Org = Tables<"organizations">;
type Invoice = Tables<"invoices">;

type Recipient = { email: string; name: string };

/** The tenant's org admins (or its dedicated billing email) and every platform owner. */
async function recipients(org: Org): Promise<{ tenant: Recipient[]; platform: Recipient[] }> {
  const admin = createAdminClient();
  const [{ data: admins }, { data: owners }] = await Promise.all([
    admin.from("app_users").select("email, full_name").eq("org_id", org.id).eq("system_role", "master_admin").neq("is_active", false),
    admin.from("app_users").select("email, full_name").eq("system_role", "platform_owner").neq("is_active", false),
  ]);
  const tenant: Recipient[] = org.billing_email
    ? [{ email: org.billing_email, name: "Team" }]
    : (admins ?? []).map((a) => ({ email: a.email, name: a.full_name }));
  return {
    tenant,
    platform: (owners ?? []).map((a) => ({ email: a.email, name: a.full_name })),
  };
}

function invoiceVars(org: Org, inv: Invoice, adminName: string) {
  return {
    admin_name: adminName,
    org_name: org.name,
    plan_name: inv.plan_name ?? org.plan,
    billing_cycle: cycleLabel(inv.billing_cycle),
    invoice_number: inv.invoice_number,
    issue_date: fmtDate(inv.issued_on),
    due_date: fmtDate(inv.due_on),
    period: inv.period_end ? `${fmtDate(inv.period_start)} to ${fmtDate(inv.period_end)}` : fmtDate(inv.period_start),
    cycle_start: fmtDate(inv.period_start),
    cycle_end: inv.period_end ? fmtDate(inv.period_end) : "—",
    amount: formatMoney(inv.amount, inv.currency),
    users: org.max_users ?? "—",
    paid_on: inv.paid_on ? fmtDate(inv.paid_on) : "",
    payment_reference: inv.payment_reference ?? "—",
  };
}

/** Emails the invoice to the tenant and the cycle reminder to tenant + platform owners. */
export async function sendInvoiceEmails(orgId: string, invoiceId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: org }, { data: inv }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle(),
  ]);
  if (!org || !inv) return;
  const { tenant, platform } = await recipients(org);

  const sent: boolean[] = [];
  for (const r of tenant) {
    const res = await sendPlatformEvent({ event: "invoice_generated", to: r.email, vars: invoiceVars(org, inv, r.name) });
    sent.push(res.ok);
  }
  // Reminder: org admins and platform owners, on the first day of the cycle.
  for (const r of [...tenant, ...platform]) {
    await sendPlatformEvent({ event: "billing_reminder", to: r.email, vars: invoiceVars(org, inv, r.name) });
  }
  if (sent.some(Boolean)) {
    await admin.from("invoices").update({ emailed_at: new Date().toISOString() }).eq("id", invoiceId);
  }
}

/** Creates the invoice for the cycle starting `periodStart` and advances the tenant's next billing date. */
export async function generateInvoice(
  org: Org,
  periodStart: string,
  today: string
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!org.plan_id) return { ok: false, error: "Tenant has no plan." };
  const { data: plan } = await admin.from("plans").select("*").eq("id", org.plan_id).maybeSingle();
  if (!plan) return { ok: false, error: "Plan not found." };

  const cycle = isBillingCycle(org.billing_cycle) ? org.billing_cycle : plan.billing_cycle;
  const next = nextCycleStart(periodStart, cycle);
  const discounts = await loadDiscounts();
  const cyclePrice = planCyclePrice(plan, cycle, discounts);
  if (cyclePrice === null) return { ok: false, error: `${plan.name} has no ${cycleLabel(cycle)} price.` };
  const amount = cycleAmount({
    cyclePrice,
    cycle,
    priceOverride: org.price_override,
    includedUsers: plan.included_users,
    extraUserPrice: Number(plan.extra_user_price),
    maxUsers: org.max_users,
  });

  const { data: inv, error } = await admin
    .from("invoices")
    .insert({
      org_id: org.id,
      plan_id: plan.id,
      plan_name: plan.name,
      billing_cycle: cycle,
      period_start: periodStart,
      period_end: next ? addDaysIso(next, -1) : null,
      amount,
      currency: plan.currency,
      status: "pending",
      issued_on: today,
      due_on: addDaysIso(today, INVOICE_DUE_DAYS),
    })
    .select("id")
    .single();
  if (error || !inv) {
    // The unique (org, period) key means this cycle was already invoiced.
    if (error?.code === "23505") {
      await admin.from("organizations").update({ next_billing_date: next }).eq("id", org.id);
      return { ok: false, error: "That cycle already has an invoice." };
    }
    return { ok: false, error: error?.message ?? "Could not create the invoice." };
  }

  await admin
    .from("organizations")
    .update({ next_billing_date: next, payment_status: "pending" })
    .eq("id", org.id);
  return { ok: true, invoiceId: inv.id };
}

export type BillingRunSummary = { invoiced: number; overdue: number; errors: string[] };

/**
 * The daily billing job: raises an invoice (and sends it with the cycle
 * reminder) for every tenant whose cycle starts today or earlier, then flags
 * unpaid invoices that passed their due date and notifies once.
 */
export async function runBilling(today: string): Promise<BillingRunSummary> {
  const admin = createAdminClient();
  const summary: BillingRunSummary = { invoiced: 0, overdue: 0, errors: [] };

  const { data: due } = await admin
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .not("plan_id", "is", null)
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", today)
    .neq("payment_status", "cancelled");

  for (const org of due ?? []) {
    // Catch up if the job missed days, but never raise more than 12 cycles at once.
    let start = org.next_billing_date!;
    for (let i = 0; i < 12 && start <= today; i++) {
      const res = await generateInvoice(org, start, today);
      if (res.ok) {
        summary.invoiced++;
        await sendInvoiceEmails(org.id, res.invoiceId);
      } else if (!res.error.includes("already")) {
        summary.errors.push(`${org.name}: ${res.error}`);
        break;
      }
      const cycle = isBillingCycle(org.billing_cycle) ? org.billing_cycle : "monthly";
      const next = nextCycleStart(start, cycle);
      if (!next) break;
      start = next;
    }
  }

  const { data: late } = await admin
    .from("invoices")
    .select("*")
    .in("status", ["pending", "overdue"])
    .lt("due_on", today);
  for (const inv of late ?? []) {
    if (inv.status === "pending") {
      await admin.from("invoices").update({ status: "overdue" }).eq("id", inv.id);
      await admin.from("organizations").update({ payment_status: "overdue" }).eq("id", inv.org_id).neq("payment_status", "cancelled");
    }
    if (!inv.overdue_notified_at) {
      const { data: org } = await admin.from("organizations").select("*").eq("id", inv.org_id).maybeSingle();
      if (org) {
        const { tenant, platform } = await recipients(org);
        for (const r of [...tenant, ...platform]) {
          await sendPlatformEvent({ event: "payment_overdue", to: r.email, vars: invoiceVars(org, inv, r.name) });
        }
        await admin.from("invoices").update({ overdue_notified_at: new Date().toISOString() }).eq("id", inv.id);
        summary.overdue++;
      }
    }
  }
  return summary;
}

/** Records payment, updates the tenant's payment status and emails the receipt. */
export async function markInvoicePaid(
  invoiceId: string,
  info: { paidOn: string; method: string | null; reference: string | null }
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "void") return { error: "That invoice was voided." };

  const { data: updated, error } = await admin
    .from("invoices")
    .update({ status: "paid", paid_on: info.paidOn, payment_method: info.method, payment_reference: info.reference })
    .eq("id", invoiceId)
    .select("*")
    .single();
  if (error || !updated) return { error: error?.message ?? "Could not update the invoice." };

  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("org_id", inv.org_id)
    .in("status", ["pending", "overdue"]);
  if (!count) await admin.from("organizations").update({ payment_status: "paid" }).eq("id", inv.org_id);

  const { data: org } = await admin.from("organizations").select("*").eq("id", inv.org_id).maybeSingle();
  if (org) {
    const { tenant } = await recipients(org);
    for (const r of tenant) {
      await sendPlatformEvent({ event: "payment_received", to: r.email, vars: invoiceVars(org, updated, r.name) });
    }
  }
  return { error: null };
}

/** Tells the tenant's admins their plan, cycle or seats changed. */
export async function notifyPlanChanged(orgId: string, change: string): Promise<void> {
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (!org) return;
  const { tenant } = await recipients(org);
  for (const r of tenant) {
    await sendPlatformEvent({
      event: "plan_changed",
      to: r.email,
      vars: {
        admin_name: r.name,
        org_name: org.name,
        plan_name: org.plan,
        billing_cycle: cycleLabel(org.billing_cycle),
        max_users: org.max_users ?? "Unlimited",
        next_billing_date: org.next_billing_date ? fmtDate(org.next_billing_date) : "—",
        change,
      },
    });
  }
}
