"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgContext } from "@/lib/org-context";
import { loadOrgEmailConfig, resolveSmtpHost, sendTestEmail } from "@/lib/email";
import { EMAIL_EVENTS, isValidEmail, parseEmailList } from "@/lib/email-events";
import type { TablesUpdate } from "@/types/database.types";

const SECURE_MODES = ["auto", "starttls", "ssl", "none"];

export type SettingsFormState = { error: string | null; success: boolean };

function isMissingColumn(message: string | undefined) {
  return !!message && /column|schema cache/i.test(message);
}

/** General: company name and timezone. */
export async function updateGeneralSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error, success: false };
  const { orgId } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!name) return { error: "Company name is required.", success: false };
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      return { error: "Pick a valid timezone.", success: false };
    }
  }

  const supabase = ctx.client ?? (await createClient());
  let { error } = await supabase
    .from("organizations")
    .update({ name, ...(timezone ? { timezone } : {}) })
    .eq("id", orgId);
  if (error && isMissingColumn(error.message) && timezone) {
    // Database not updated with the timezone column yet: still save the name.
    ({ error } = await supabase.from("organizations").update({ name }).eq("id", orgId));
    if (!error) {
      revalidatePath("/org-settings");
      return {
        error: "Company name saved, but the timezone could not be stored: apply the latest database migration first.",
        success: false,
      };
    }
  }
  if (error) return { error: error.message, success: false };

  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null, success: true };
}

/** SMTP connection and sender only. */
export async function updateSmtpSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error, success: false };
  const { orgId } = ctx;

  const smtpHost = String(formData.get("smtpHost") ?? "").trim() || null;
  const smtpPortRaw = String(formData.get("smtpPort") ?? "").trim();
  const smtpPort = smtpPortRaw ? Number(smtpPortRaw) : null;
  const smtpUsername = String(formData.get("smtpUsername") ?? "").trim() || null;
  const smtpPasswordRaw = String(formData.get("smtpPassword") ?? "");
  const smtpFromEmail = String(formData.get("smtpFromEmail") ?? "").trim() || null;
  const smtpFromName = String(formData.get("smtpFromName") ?? "").trim().slice(0, 120) || null;
  const smtpSecure = String(formData.get("smtpSecure") ?? "auto");

  if (!SECURE_MODES.includes(smtpSecure)) {
    return { error: "Pick a valid encryption mode.", success: false };
  }
  if (smtpPort !== null && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
    return { error: "SMTP port must be a number between 1 and 65535.", success: false };
  }
  if (smtpFromEmail && !isValidEmail(smtpFromEmail)) {
    return { error: "Enter a valid From email address.", success: false };
  }
  if (smtpHost) {
    try {
      await resolveSmtpHost(smtpHost);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Invalid SMTP host.", success: false };
    }
  }

  const supabase = ctx.client ?? (await createClient());
  const update: TablesUpdate<"organizations"> = {
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_username: smtpUsername,
    smtp_from_email: smtpFromEmail,
    smtp_from_name: smtpFromName,
    smtp_secure: smtpSecure,
  };
  // Only overwrite the stored password if a new one was typed -- the field is
  // rendered blank on load, so an empty submit means "keep it".
  if (smtpPasswordRaw) update.smtp_password = smtpPasswordRaw;

  const { error } = await supabase.from("organizations").update(update).eq("id", orgId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null, success: true };
}

/** Email options: signature, daily reminder time, and the always-copied addresses. */
export async function updateEmailOptions(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error, success: false };
  const { orgId } = ctx;

  const reminderTime = String(formData.get("reminderTime") ?? "").trim() || null;
  const ccEnabled = formData.get("smtpCcEnabled") === "on";
  const bccEnabled = formData.get("smtpBccEnabled") === "on";
  const ccList = parseEmailList(String(formData.get("smtpCc") ?? ""));
  const bccList = parseEmailList(String(formData.get("smtpBcc") ?? ""));
  const signature =
    String(formData.get("emailSignature") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1000) || null;

  if (ccEnabled && ccList.length === 0) {
    return { error: "Add at least one valid Cc address, or untick it.", success: false };
  }
  if (bccEnabled && bccList.length === 0) {
    return { error: "Add at least one valid Bcc address, or untick it.", success: false };
  }

  const supabase = ctx.client ?? (await createClient());
  const { error } = await supabase
    .from("organizations")
    .update({
      reminder_time: reminderTime,
      smtp_cc_enabled: ccEnabled,
      smtp_cc: ccList.length ? ccList.join(", ") : null,
      smtp_bcc_enabled: bccEnabled,
      smtp_bcc: bccList.length ? bccList.join(", ") : null,
      email_signature: signature,
    })
    .eq("id", orgId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null, success: true };
}

export type TestEmailState = { ok: boolean; message: string } | null;

/** Sends a test message using the values currently typed in the form (saved or not). */
export async function sendTestEmailAction(formData: FormData): Promise<NonNullable<TestEmailState>> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const stored = await loadOrgEmailConfig(ctx.orgId);
  if (!stored) return { ok: false, message: "Organization not found." };

  const portRaw = String(formData.get("smtpPort") ?? "").trim();
  const typedPassword = String(formData.get("smtpPassword") ?? "");
  const secure = String(formData.get("smtpSecure") ?? "auto");

  const result = await sendTestEmail(
    {
      name: stored.name,
      smtp_host: String(formData.get("smtpHost") ?? "").trim() || null,
      smtp_port: portRaw ? Number(portRaw) : null,
      smtp_username: String(formData.get("smtpUsername") ?? "").trim() || null,
      // Blank means "keep the saved password" -- same rule as saving.
      smtp_password: typedPassword || stored.smtp_password,
      smtp_secure: SECURE_MODES.includes(secure) ? secure : "auto",
      smtp_from_email: String(formData.get("smtpFromEmail") ?? "").trim() || null,
      smtp_from_name: String(formData.get("smtpFromName") ?? "").trim() || null,
      email_signature: stored.email_signature,
    },
    appUser.email
  );

  return result.ok
    ? { ok: true, message: `Test email sent to ${appUser.email}. Check your inbox (and spam folder).` }
    : { ok: false, message: result.error };
}

export type TemplatesFormState = { error: string | null; success: boolean };

export async function saveEmailTemplates(
  _prev: TemplatesFormState,
  formData: FormData
): Promise<TemplatesFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error, success: false };
  const { orgId } = ctx;

  const rows = EMAIL_EVENTS.map((def) => {
    const subject = String(formData.get(`subject_${def.id}`) ?? "").trim();
    const body = String(formData.get(`body_${def.id}`) ?? "").replace(/\r\n/g, "\n").trim();
    return {
      org_id: orgId,
      event: def.id,
      enabled: formData.get(`enabled_${def.id}`) === "on",
      cc_l1: formData.get(`cc_l1_${def.id}`) === "on",
      cc_l2: formData.get(`cc_l2_${def.id}`) === "on",
      bcc_l1: formData.get(`bcc_l1_${def.id}`) === "on",
      bcc_l2: formData.get(`bcc_l2_${def.id}`) === "on",
      // Identical to the built-in wording (or blank) is stored as null so
      // future improvements to the defaults still reach this org.
      subject: subject && subject !== def.defaultSubject ? subject.slice(0, 300) : null,
      body: body && body !== def.defaultBody.trim() ? body.slice(0, 8000) : null,
      updated_at: new Date().toISOString(),
    };
  });

  const supabase = ctx.client ?? (await createClient());
  let { error } = await supabase
    .from("org_email_templates")
    .upsert(rows, { onConflict: "org_id,event" });
  if (error && isMissingColumn(error.message)) {
    // Database not updated with the Cc/Bcc columns yet: still save the wording.
    const plain = rows.map(({ cc_l1, cc_l2, bcc_l1, bcc_l2, ...rest }) => {
      void cc_l1; void cc_l2; void bcc_l1; void bcc_l2;
      return rest;
    });
    ({ error } = await supabase
      .from("org_email_templates")
      .upsert(plain, { onConflict: "org_id,event" }));
    if (!error) {
      revalidatePath("/org-settings");
      return {
        error: "Wording saved, but the Cc/Bcc choices could not be stored: apply the latest database migration first.",
        success: false,
      };
    }
  }
  if (error) return { error: error.message, success: false };

  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null, success: true };
}

export type LogoFormState = { error: string | null };

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

export async function uploadOrgLogo(
  _prev: LogoFormState,
  formData: FormData
): Promise<LogoFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file." };
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return { error: "Logo must be a PNG, JPEG, WebP, or SVG image." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Logo must be under 2MB." };
  }

  // master_admin uploads via their own RLS-scoped client (the org_logos_*
  // storage policies check current_org_id() against the path's org folder);
  // platform_owner uses the resolved admin client to write into any org's
  // folder.
  const supabase = ctx.client ?? (await createClient());
  const ext = file.name.split(".").pop() || "png";
  const path = `${orgId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("org-logos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("org-logos").getPublicUrl(path);
  // Cache-bust so the login page and org settings pick up a replaced logo
  // immediately instead of an old cached image at the same URL.
  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", orgId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  revalidatePath("/login");
  return { error: null };
}

export type DomainFormState = { error: string | null; domain?: string };

export async function updateLoginDomain(
  _prev: DomainFormState,
  formData: FormData
): Promise<DomainFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  let domain = String(formData.get("domain") ?? "").trim().replace(/\/+$/, "");
  if (!domain) return { error: "Domain is required." };
  if (!/^https?:\/\//i.test(domain)) domain = `https://${domain}`;
  try {
    new URL(domain);
  } catch {
    return { error: "Enter a valid domain, e.g. tasks.yourcompany.com." };
  }

  const supabase = ctx.client ?? (await createClient());
  const { error } = await supabase
    .from("organizations")
    .update({ custom_login_domain: domain })
    .eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  // Returned so the form can sync its displayed URL to the normalized
  // value (e.g. "https://" prepended) without waiting for a page reload.
  return { error: null, domain };
}
