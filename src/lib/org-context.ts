import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/auth";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolves which org a tenant-management mutation targets and which client
 * to use for the write. master_admin always acts on their own org via the
 * caller's RLS-scoped client (returned client is null -- callers fall back
 * to their own `createClient()`). platform_owner has no org_id of their
 * own, so RLS's current_org_id() is null for them -- they target an
 * explicit orgId (a hidden field on the tenant-management pages) and get
 * the service-role client to bypass the org-scoped RLS checks that only
 * cover master_admin/reporting_manager.
 */
export function resolveOrgContext(
  appUser: AppUser,
  formData: FormData
): { error: string } | { orgId: string; client: AdminClient | null } {
  if (appUser.system_role === "platform_owner") {
    const orgId = String(formData.get("orgId") ?? "");
    if (!orgId) return { error: "No tenant selected." };
    return { orgId, client: createAdminClient() };
  }
  if (!appUser.org_id) return { error: "No organization on this account." };
  return { orgId: appUser.org_id, client: null };
}
