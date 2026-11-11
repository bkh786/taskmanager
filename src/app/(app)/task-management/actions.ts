"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAssignableEmployees } from "@/lib/org-data";
import { REMOVAL_REASONS } from "@/lib/removal-reasons";

export type BulkRemoveState = { error: string | null; removed: number; skipped: number };

/**
 * Removes the selected open (due or overdue) task occurrences. Done only from
 * the portal, and only with a reason: both a reason from the list and written
 * details are required. A manager can only remove within their reporting chain.
 */
export async function bulkRemoveInstances(
  _prev: BulkRemoveState,
  formData: FormData
): Promise<BulkRemoveState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  const ids = [...new Set(formData.getAll("instanceIds").map(String).filter(Boolean))];
  const reasonCode = String(formData.get("reasonCode") ?? "");
  const reasonDetail = String(formData.get("reasonDetail") ?? "").trim();

  if (ids.length === 0) return { error: "Select at least one task to remove.", removed: 0, skipped: 0 };
  if (ids.length > 2000) return { error: "Remove up to 2,000 tasks at a time.", removed: 0, skipped: 0 };
  if (!(REMOVAL_REASONS as readonly string[]).includes(reasonCode)) {
    return { error: "Choose a reason for the removal.", removed: 0, skipped: 0 };
  }
  if (reasonDetail.length < 3) {
    return { error: "Describe the reason for the removal.", removed: 0, skipped: 0 };
  }
  const removalReason = `${reasonCode}: ${reasonDetail}`.slice(0, 500);

  const supabase = await createClient();
  // Who this person may act on (a manager's reporting chain; an admin's whole org).
  const allowed = new Set(
    (await getAssignableEmployees(appUser, { includeInactive: true })).map((e) => e.id)
  );

  const valid: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("task_instances")
      .select("id, assignee_id, status, removed")
      .in("id", ids.slice(i, i + 100));
    if (error) return { error: error.message, removed: 0, skipped: 0 };
    for (const r of data ?? []) {
      if (!r.removed && r.status !== "completed" && r.assignee_id && allowed.has(r.assignee_id)) {
        valid.push(r.id);
      }
    }
  }
  if (valid.length === 0) {
    return { error: "None of the selected tasks can be removed (completed, already removed, or outside your team).", removed: 0, skipped: ids.length };
  }

  const now = new Date().toISOString();
  for (let i = 0; i < valid.length; i += 100) {
    const { error } = await supabase
      .from("task_instances")
      .update({
        removed: true,
        removal_reason: removalReason,
        removed_by: appUser.id,
        removed_at: now,
        status: "removed",
      })
      .in("id", valid.slice(i, i + 100))
      .eq("removed", false)
      .neq("status", "completed");
    if (error) return { error: error.message, removed: i, skipped: ids.length - i };
  }

  revalidatePath("/dashboard");
  revalidatePath("/org-dashboard");
  revalidatePath("/task-management");
  return { error: null, removed: valid.length, skipped: ids.length - valid.length };
}
