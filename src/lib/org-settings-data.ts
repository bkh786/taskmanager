import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database.types";
import type { OrgSettingsOrg } from "@/components/org-settings/settings-form";
import type { SavedTemplates } from "@/components/org-settings/notification-templates-form";

/** Strips the SMTP password; the settings screen only ever learns whether one is saved. */
export function toSettingsOrg(row: Tables<"organizations">): OrgSettingsOrg {
  const { smtp_password, ...rest } = row;
  return { ...rest, has_smtp_password: !!smtp_password };
}

/**
 * Reads with the service role: SMTP credentials aren't readable through the
 * API by logged-in users. Callers must have already authorized the viewer for
 * this org (master_admin of it, or platform_owner).
 */
export async function getOrgSettings(orgId: string): Promise<OrgSettingsOrg | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();
  return data ? toSettingsOrg(data) : null;
}

export async function getSavedTemplates(orgId: string): Promise<SavedTemplates> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_email_templates")
    .select("*")
    .eq("org_id", orgId);
  const out: SavedTemplates = {};
  for (const r of data ?? []) {
    out[r.event] = {
      enabled: r.enabled,
      subject: r.subject,
      body: r.body,
      cc_l1: r.cc_l1 ?? false,
      cc_l2: r.cc_l2 ?? false,
      bcc_l1: r.bcc_l1 ?? false,
      bcc_l2: r.bcc_l2 ?? false,
    };
  }
  return out;
}
