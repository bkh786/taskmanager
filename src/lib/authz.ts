import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth";

/**
 * Whether `appUser` is authorized to view or act on a task/instance
 * assigned to `assigneeId`. RLS only isolates by org, not by role or
 * reporting hierarchy, so this has to be checked explicitly in every
 * action/page that takes a task/instance id from the client:
 *   - master_admin / platform_owner: org-wide (RLS already confines reads
 *     to their own org; platform_owner's cross-tenant pages use the
 *     service-role client and don't call this).
 *   - reporting_manager: only within their reporting chain.
 *   - user: only their own tasks.
 */
export async function canManageAssignee(
  appUser: AppUser,
  assigneeId: string | null
): Promise<boolean> {
  if (!assigneeId) return false;
  if (appUser.system_role === "master_admin" || appUser.system_role === "platform_owner") {
    return true;
  }
  if (appUser.system_role === "user") {
    return assigneeId === appUser.id;
  }

  const supabase = await createClient();
  const { data: chain, error } = await supabase.rpc("reporting_chain", {
    p_manager_id: appUser.id,
  });
  if (error) throw error;
  return (chain ?? []).some((m) => m.id === assigneeId);
}
