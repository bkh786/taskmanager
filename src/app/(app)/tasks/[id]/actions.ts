"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageAssignee } from "@/lib/authz";
import { getAssignableEmployees } from "@/lib/org-data";

export type FormState = { error: string | null };

export async function transferTaskInstance(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);

  const instanceId = String(formData.get("instanceId") ?? "");
  const newAssigneeId = String(formData.get("newAssigneeId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!instanceId || !newAssigneeId) {
    return { error: "Pick a new assignee." };
  }

  const supabase = await createClient();

  const { data: instance, error: fetchError } = await supabase
    .from("task_instances")
    .select("assignee_id")
    .eq("id", instanceId)
    .single();
  if (fetchError || !instance) return { error: "Task instance not found." };

  // RLS only confines this to the caller's org -- a reporting_manager could
  // otherwise transfer any instance in the org (or to any target), not just
  // within their own reporting chain.
  if (!(await canManageAssignee(appUser, instance.assignee_id))) {
    return { error: "You can only transfer tasks within your reporting chain." };
  }
  const assignable = await getAssignableEmployees(appUser);
  if (!assignable.some((e) => e.id === newAssigneeId)) {
    return { error: "You are not allowed to assign tasks to that person." };
  }

  const { error: updateError } = await supabase
    .from("task_instances")
    .update({ assignee_id: newAssigneeId })
    .eq("id", instanceId);
  if (updateError) return { error: updateError.message };

  const { error: logError } = await supabase.from("task_transfer_log").insert({
    task_instance_id: instanceId,
    from_user_id: instance.assignee_id,
    to_user_id: newAssigneeId,
    transferred_by: appUser.id,
    reason: reason || null,
  });
  if (logError) return { error: logError.message };

  revalidatePath(`/tasks/${instanceId}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function removeTaskInstance(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);

  const instanceId = String(formData.get("instanceId") ?? "");
  const scope = String(formData.get("scope") ?? "instance"); // "instance" | "task"
  const reasonCode = String(formData.get("reasonCode") ?? "");
  const reasonDetail = String(formData.get("reasonDetail") ?? "").trim();

  if (!instanceId || !reasonCode) {
    return { error: "A removal reason is required." };
  }
  const removalReason = reasonDetail ? `${reasonCode}: ${reasonDetail}` : reasonCode;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: instance, error: fetchError } = await supabase
    .from("task_instances")
    .select("task_id, assignee_id")
    .eq("id", instanceId)
    .single();
  if (fetchError || !instance) return { error: "Task instance not found." };

  // RLS only confines this to the caller's org -- a reporting_manager could
  // otherwise remove any task/instance in the org, not just their own
  // reporting chain's.
  if (!(await canManageAssignee(appUser, instance.assignee_id))) {
    return { error: "You can only remove tasks within your reporting chain." };
  }

  if (scope === "task") {
    if (!instance.task_id) return { error: "Task not found." };

    // A task's instances can have been individually transferred since
    // creation, so also check against the task's own (original) assignee --
    // removing the whole task is a bigger blast radius than one instance.
    const { data: taskRow } = await supabase
      .from("tasks")
      .select("assignee_id")
      .eq("id", instance.task_id)
      .single();
    if (!taskRow || !(await canManageAssignee(appUser, taskRow.assignee_id))) {
      return { error: "You can only remove tasks within your reporting chain." };
    }

    const { error: taskError } = await supabase
      .from("tasks")
      .update({ is_active: false })
      .eq("id", instance.task_id);
    if (taskError) return { error: taskError.message };

    const { error: instancesError } = await supabase
      .from("task_instances")
      .update({
        removed: true,
        removal_reason: removalReason,
        removed_by: appUser.id,
        removed_at: now,
        status: "removed",
      })
      .eq("task_id", instance.task_id)
      .eq("removed", false)
      .neq("status", "completed");
    if (instancesError) return { error: instancesError.message };
  } else {
    const { error } = await supabase
      .from("task_instances")
      .update({
        removed: true,
        removal_reason: removalReason,
        removed_by: appUser.id,
        removed_at: now,
        status: "removed",
      })
      .eq("id", instanceId);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: null };
}
