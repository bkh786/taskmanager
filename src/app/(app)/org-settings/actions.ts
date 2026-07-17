"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgContext } from "@/lib/org-context";
import type { TablesUpdate } from "@/types/database.types";

export type SettingsFormState = { error: string | null; success: boolean };

export async function updateOrgSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error, success: false };
  const { orgId } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  const smtpHost = String(formData.get("smtpHost") ?? "").trim() || null;
  const smtpPortRaw = String(formData.get("smtpPort") ?? "").trim();
  const smtpPort = smtpPortRaw ? Number(smtpPortRaw) : null;
  const smtpUsername = String(formData.get("smtpUsername") ?? "").trim() || null;
  const smtpPasswordRaw = String(formData.get("smtpPassword") ?? "");
  const smtpFromEmail = String(formData.get("smtpFromEmail") ?? "").trim() || null;
  const reminderTime = String(formData.get("reminderTime") ?? "").trim() || null;

  if (!name) return { error: "Company name is required.", success: false };

  const supabase = ctx.client ?? (await createClient());

  const update: TablesUpdate<"organizations"> = {
    name,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_username: smtpUsername,
    smtp_from_email: smtpFromEmail,
    reminder_time: reminderTime,
  };
  // Only overwrite the stored password if the admin typed a new one --
  // the field is rendered blank on load, so an empty submit means "keep it".
  if (smtpPasswordRaw) update.smtp_password = smtpPasswordRaw;

  const { error } = await supabase.from("organizations").update(update).eq("id", orgId);
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
