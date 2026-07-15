"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database.types";

export type SettingsFormState = { error: string | null; success: boolean };

export async function updateOrgSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const appUser = await requireRole(["master_admin"]);
  if (!appUser.org_id) return { error: "No organization on this account.", success: false };

  const name = String(formData.get("name") ?? "").trim();
  const smtpHost = String(formData.get("smtpHost") ?? "").trim() || null;
  const smtpPortRaw = String(formData.get("smtpPort") ?? "").trim();
  const smtpPort = smtpPortRaw ? Number(smtpPortRaw) : null;
  const smtpUsername = String(formData.get("smtpUsername") ?? "").trim() || null;
  const smtpPasswordRaw = String(formData.get("smtpPassword") ?? "");
  const smtpFromEmail = String(formData.get("smtpFromEmail") ?? "").trim() || null;
  const reminderTime = String(formData.get("reminderTime") ?? "").trim() || null;

  if (!name) return { error: "Company name is required.", success: false };

  const supabase = await createClient();

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

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", appUser.org_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/org-settings");
  return { error: null, success: true };
}
