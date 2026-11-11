"use server";

import { revalidatePath } from "next/cache";
import type { TablesUpdate } from "@/types/database.types";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSmtpHost } from "@/lib/email";
import { isValidEmail, parseEmailList } from "@/lib/email-events";
import { loadPlatformEmailSettings, sendPlatformTestEmail } from "@/lib/platform-email";
import { PLATFORM_EVENTS } from "@/lib/platform-email-events";
import { generateInvoice, markInvoicePaid, notifyPlanChanged, runBilling, sendInvoiceEmails } from "@/lib/billing";
import { isBillingCycle, PAYMENT_STATUSES } from "@/lib/billing-shared";

export type FormState = { error: string | null; success: boolean };
const fail = (error: string): FormState => ({ error, success: false });
const ok: FormState = { error: null, success: true };

const SECURE_MODES = ["auto", "starttls", "ssl", "none"];
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// ------------------------------------------------------------------ plans

export async function savePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["platform_owner"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const cycle = String(formData.get("billingCycle") ?? "");
  const price = Number(formData.get("price") ?? 0);
  const included = String(formData.get("includedUsers") ?? "").trim();
  const extra = Number(formData.get("extraUserPrice") || 0);
  if (!name) return fail("Plan name is required.");
  if (!isBillingCycle(cycle)) return fail("Pick a billing cycle.");
  if (!Number.isFinite(price) || price < 0) return fail("Enter a valid price.");
  if (!Number.isFinite(extra) || extra < 0) return fail("Enter a valid price per extra user.");

  const row = {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    price,
    currency: String(formData.get("currency") ?? "INR").trim().toUpperCase().slice(0, 3) || "INR",
    billing_cycle: cycle,
    included_users: included ? Math.max(1, Math.floor(Number(included))) : null,
    extra_user_price: extra,
    is_active: formData.get("isActive") === "on",
  };
  const admin = createAdminClient();
  const { error } = id ? await admin.from("plans").update(row).eq("id", id) : await admin.from("plans").insert(row);
  if (error) return fail(error.code === "23505" ? "A plan with that name already exists." : error.message);
  revalidatePath("/plan-master");
  revalidatePath("/tenants");
  return ok;
}

// ------------------------------------------------------- platform SMTP

export async function savePlatformSmtp(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["platform_owner"]);
  const host = String(formData.get("smtpHost") ?? "").trim() || null;
  const portRaw = String(formData.get("smtpPort") ?? "").trim();
  const port = portRaw ? Number(portRaw) : null;
  const secure = String(formData.get("smtpSecure") ?? "auto");
  const fromEmail = String(formData.get("smtpFromEmail") ?? "").trim() || null;
  const replyTo = String(formData.get("replyTo") ?? "").trim() || null;
  const password = String(formData.get("smtpPassword") ?? "");

  if (!SECURE_MODES.includes(secure)) return fail("Pick a valid encryption mode.");
  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) return fail("Port must be 1–65535.");
  if (fromEmail && !isValidEmail(fromEmail)) return fail("Enter a valid From email address.");
  if (replyTo && !isValidEmail(replyTo)) return fail("Enter a valid reply-to address.");
  if (host) {
    try {
      await resolveSmtpHost(host);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Invalid SMTP host.");
    }
  }

  const update: TablesUpdate<"platform_email_settings"> = {
    smtp_host: host,
    smtp_port: port,
    smtp_username: String(formData.get("smtpUsername") ?? "").trim() || null,
    smtp_secure: secure,
    smtp_from_email: fromEmail,
    smtp_from_name: String(formData.get("smtpFromName") ?? "").trim().slice(0, 120) || null,
    reply_to: replyTo,
    billing_cc: parseEmailList(String(formData.get("billingCc") ?? "")).join(", ") || null,
    email_signature: String(formData.get("signature") ?? "").trim().slice(0, 1000) || null,
    updated_at: new Date().toISOString(),
  };
  // Blank password means "keep the saved one".
  if (password) update.smtp_password = password;

  const { error } = await createAdminClient().from("platform_email_settings").update(update).eq("id", 1);
  if (error) return fail(error.message);
  revalidatePath("/platform-settings");
  return ok;
}

export async function sendPlatformTestAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const appUser = await requireRole(["platform_owner"]);
  const stored = await loadPlatformEmailSettings();
  const portRaw = String(formData.get("smtpPort") ?? "").trim();
  const secure = String(formData.get("smtpSecure") ?? "auto");
  const result = await sendPlatformTestEmail(
    {
      smtp_host: String(formData.get("smtpHost") ?? "").trim() || null,
      smtp_port: portRaw ? Number(portRaw) : null,
      smtp_username: String(formData.get("smtpUsername") ?? "").trim() || null,
      smtp_password: String(formData.get("smtpPassword") ?? "") || stored?.smtp_password || null,
      smtp_secure: SECURE_MODES.includes(secure) ? secure : "auto",
      smtp_from_email: String(formData.get("smtpFromEmail") ?? "").trim() || null,
      smtp_from_name: String(formData.get("smtpFromName") ?? "").trim() || null,
      email_signature: stored?.email_signature ?? null,
    },
    appUser.email
  );
  return result.ok
    ? { ok: true, message: `Test email sent to ${appUser.email}. Check your inbox (and spam folder).` }
    : { ok: false, message: result.error };
}

export async function savePlatformTemplates(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["platform_owner"]);
  const rows = PLATFORM_EVENTS.map((def) => {
    const subject = String(formData.get(`subject_${def.id}`) ?? "").trim();
    const body = String(formData.get(`body_${def.id}`) ?? "").replace(/\r\n/g, "\n").trim();
    return {
      event: def.id,
      enabled: formData.get(`enabled_${def.id}`) === "on",
      subject: subject && subject !== def.defaultSubject ? subject.slice(0, 300) : null,
      body: body && body !== def.defaultBody.trim() ? body.slice(0, 8000) : null,
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await createAdminClient().from("platform_email_templates").upsert(rows, { onConflict: "event" });
  if (error) return fail(error.message);
  revalidatePath("/platform-settings");
  return ok;
}

// ------------------------------------------------------ tenant billing

/** Plan, cycle, start date, tenant-specific price, billing contact and payment status. */
export async function saveTenantBilling(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["platform_owner"]);
  const orgId = String(formData.get("orgId") ?? "");
  const planId = String(formData.get("planId") ?? "") || null;
  const cycleInput = String(formData.get("billingCycle") ?? "");
  const startDate = String(formData.get("billingStartDate") ?? "") || null;
  const overrideRaw = String(formData.get("priceOverride") ?? "").trim();
  const billingEmail = String(formData.get("billingEmail") ?? "").trim().toLowerCase() || null;
  const payment = String(formData.get("paymentStatus") ?? "");
  const notes = String(formData.get("billingNotes") ?? "").trim().slice(0, 1000) || null;

  if (!orgId) return fail("Tenant not found.");
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return fail("Enter a valid billing start date.");
  if (billingEmail && !isValidEmail(billingEmail)) return fail("Enter a valid billing email.");
  if (!PAYMENT_STATUSES.some((p) => p.value === payment)) return fail("Pick a payment status.");
  const override = overrideRaw ? Number(overrideRaw) : null;
  if (override !== null && (!Number.isFinite(override) || override < 0)) return fail("Enter a valid custom price.");

  const admin = createAdminClient();
  const { data: before } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (!before) return fail("Tenant not found.");
  const { data: plan } = planId ? await admin.from("plans").select("*").eq("id", planId).maybeSingle() : { data: null };
  if (planId && !plan) return fail("Plan not found.");

  const cycle = isBillingCycle(cycleInput) ? cycleInput : (plan?.billing_cycle ?? null);
  const update: TablesUpdate<"organizations"> = {
    plan_id: planId,
    plan: plan?.name ?? before.plan,
    billing_cycle: cycle,
    billing_start_date: startDate,
    price_override: override,
    billing_email: billingEmail,
    payment_status: payment,
    billing_status: PAYMENT_STATUSES.find((p) => p.value === payment)?.label ?? before.billing_status,
    billing_notes: notes,
  };
  // A new or changed start date restarts the schedule: the first invoice is
  // raised (with the reminder) on that day.
  if (startDate && startDate !== before.billing_start_date) update.next_billing_date = startDate;
  if (!startDate) update.next_billing_date = null;

  const { error } = await admin.from("organizations").update(update).eq("id", orgId);
  if (error) return fail(error.message);

  const changes: string[] = [];
  if (planId !== before.plan_id) changes.push(`Plan changed to ${plan?.name ?? "none"}.`);
  if (cycle !== before.billing_cycle) changes.push("Billing cycle changed.");
  if (changes.length) await notifyPlanChanged(orgId, changes.join(" "));

  revalidatePath(`/tenants/${orgId}`);
  revalidatePath("/tenants");
  return ok;
}

/** Tenant management: user limit, active flag and auto-deactivation date. */
export async function saveTenantManagement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["platform_owner"]);
  const orgId = String(formData.get("orgId") ?? "");
  const maxRaw = String(formData.get("maxUsers") ?? "").trim();
  const maxUsers = maxRaw ? Math.floor(Number(maxRaw)) : null;
  const isActive = formData.get("isActive") === "on";
  const autoDeactivate = String(formData.get("autoDeactivateDate") ?? "") || null;
  if (!orgId) return fail("Tenant not found.");
  if (maxUsers !== null && (!Number.isFinite(maxUsers) || maxUsers < 1)) return fail("User limit must be 1 or more.");

  const admin = createAdminClient();
  const { data: before } = await admin.from("organizations").select("max_users").eq("id", orgId).maybeSingle();
  if (maxUsers !== null) {
    const { count } = await admin.from("app_users").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    if ((count ?? 0) > maxUsers) return fail(`This tenant already has ${count} users; the limit can't go below that.`);
  }
  const { error } = await admin
    .from("organizations")
    .update({ max_users: maxUsers, is_active: isActive, auto_deactivate_date: autoDeactivate })
    .eq("id", orgId);
  if (error) return fail(error.message);

  if (before && before.max_users !== maxUsers) {
    await notifyPlanChanged(orgId, `Your user limit changed from ${before.max_users ?? "unlimited"} to ${maxUsers ?? "unlimited"}.`);
  }
  revalidatePath(`/tenants/${orgId}`);
  revalidatePath("/tenants");
  return ok;
}

// -------------------------------------------------------------- invoices

export async function generateInvoiceNow(orgId: string): Promise<{ error: string | null }> {
  await requireRole(["platform_owner"]);
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (!org) return { error: "Tenant not found." };
  const today = todayIso();
  const start = org.next_billing_date ?? org.billing_start_date ?? today;
  const res = await generateInvoice(org, start, today);
  if (!res.ok) return { error: res.error };
  await sendInvoiceEmails(orgId, res.invoiceId);
  revalidatePath(`/tenants/${orgId}`);
  revalidatePath("/invoices");
  return { error: null };
}

export async function recordPayment(formData: FormData): Promise<{ error: string | null }> {
  await requireRole(["platform_owner"]);
  const id = String(formData.get("invoiceId") ?? "");
  const paidOn = String(formData.get("paidOn") ?? "") || todayIso();
  const res = await markInvoicePaid(id, {
    paidOn,
    method: String(formData.get("method") ?? "").trim() || null,
    reference: String(formData.get("reference") ?? "").trim() || null,
  });
  if (!res.error) {
    revalidatePath("/invoices");
    revalidatePath("/tenants", "layout");
  }
  return res;
}

export async function voidInvoice(invoiceId: string): Promise<{ error: string | null }> {
  await requireRole(["platform_owner"]);
  const { error } = await createAdminClient().from("invoices").update({ status: "void" }).eq("id", invoiceId).neq("status", "paid");
  revalidatePath("/invoices");
  revalidatePath("/tenants", "layout");
  return { error: error?.message ?? null };
}

export async function resendInvoice(invoiceId: string): Promise<{ error: string | null }> {
  await requireRole(["platform_owner"]);
  const { data } = await createAdminClient().from("invoices").select("org_id").eq("id", invoiceId).maybeSingle();
  if (!data) return { error: "Invoice not found." };
  await sendInvoiceEmails(data.org_id, invoiceId);
  revalidatePath("/invoices");
  return { error: null };
}

/** Runs the daily job on demand (same as the scheduled one). */
export async function runBillingNow(): Promise<{ error: string | null; message: string }> {
  await requireRole(["platform_owner"]);
  const s = await runBilling(todayIso());
  revalidatePath("/invoices");
  revalidatePath("/tenants", "layout");
  return {
    error: s.errors.length ? s.errors.join("; ") : null,
    message: `${s.invoiced} invoice(s) raised, ${s.overdue} overdue notice(s) sent.`,
  };
}
