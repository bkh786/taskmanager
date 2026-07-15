"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  if (scope === "task") {
    const { data: instance, error: fetchError } = await supabase
      .from("task_instances")
      .select("task_id")
      .eq("id", instanceId)
      .single();
    if (fetchError || !instance?.task_id) return { error: "Task not found." };

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
