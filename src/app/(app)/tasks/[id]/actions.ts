"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageAssignee } from "@/lib/authz";
import { getAssignableEmployees } from "@/lib/org-data";
import { todayIso } from "@/lib/task-status";
import type { Enums } from "@/types/database.types";

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

export type UpdateTaskState = { error: string | null };

export async function updateTask(
  _prev: UpdateTaskState,
  formData: FormData
): Promise<UpdateTaskState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);

  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return { error: "Missing task." };

  const supabase = await createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, assignee_id, start_date")
    .eq("id", taskId)
    .single();
  if (fetchError || !task) return { error: "Task not found." };

  // RLS only confines this to the caller's org -- a reporting_manager could
  // otherwise edit any task in the org, not just their reporting chain's.
  if (!(await canManageAssignee(appUser, task.assignee_id))) {
    return { error: "You can only edit tasks within your reporting chain." };
  }

  const taskName = String(formData.get("taskName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const recurrenceKind = String(
    formData.get("recurrenceKind") ?? "one_time"
  ) as Enums<"recurrence_kind">;
  const isRecurring = recurrenceKind !== "one_time";
  const recurrenceInterval = Math.max(1, Number(formData.get("recurrenceInterval") ?? 1));
  const excludedWeekdays =
    recurrenceKind === "daily"
      ? formData.getAll("excludedWeekdays").map((v) => Number(v))
      : [];
  const noEnd = formData.get("noEnd") === "on";
  const endDate = noEnd ? null : String(formData.get("endDate") ?? "") || null;
  const reminderEnabled = formData.get("reminderEnabled") === "on";

  if (!taskName) return { error: "Task name is required." };

  // Instances due today or earlier, or already completed, are already
  // committed -- an edit can't retroactively cut them off by setting an
  // end date before them.
  if (endDate) {
    const { data: committed } = await supabase
      .from("task_instances")
      .select("due_date")
      .eq("task_id", taskId)
      .or(`due_date.lte.${todayIso()},status.eq.completed`)
      .order("due_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const floor = committed?.due_date ?? task.start_date;
    if (endDate < floor) {
      return {
        error: `End date can't be before ${floor} -- an instance for that date already exists.`,
      };
    }
    if (endDate < task.start_date) {
      return { error: "End date can't be before the start date." };
    }
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      task_name: taskName,
      description: description || null,
      is_recurring: isRecurring,
      recurrence_kind: recurrenceKind,
      recurrence_interval: isRecurring ? recurrenceInterval : 1,
      excluded_weekdays: recurrenceKind === "daily" ? excludedWeekdays : [],
      end_date: endDate,
      reminder_enabled: reminderEnabled,
    })
    .eq("id", taskId);
  if (updateError) return { error: updateError.message };

  // Only future, not-yet-completed instances are regenerated to match the
  // new schedule -- past/overdue/completed instances are left untouched so
  // editing a task never rewrites history.
  const { error: pruneError } = await supabase
    .from("task_instances")
    .delete()
    .eq("task_id", taskId)
    .gt("due_date", todayIso())
    .neq("status", "completed");
  if (pruneError) return { error: pruneError.message };

  const { error: genError } = await supabase.rpc("generate_task_instances", {
    p_task_id: taskId,
  });
  if (genError) {
    return { error: `Task updated, but rescheduling failed: ${genError.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/tasks/${taskId}`);
  return { error: null };
}
