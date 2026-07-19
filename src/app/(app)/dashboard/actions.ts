"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { sendOrgEmail } from "@/lib/email";
import { fmtDate } from "@/lib/task-status";
import { getAssignableEmployees } from "@/lib/org-data";
import type { Enums } from "@/types/database.types";

export type FormState = { error: string | null };

export async function createTask(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  if (!appUser.org_id) return { error: "No organization on this account." };

  const taskName = String(formData.get("taskName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const isRecurring = formData.get("scheduleType") === "recurring";
  const recurrenceKind = String(
    formData.get("recurrenceKind") ?? "one_time"
  ) as Enums<"recurrence_kind">;
  const recurrenceInterval = Math.max(
    1,
    Number(formData.get("recurrenceInterval") ?? 1)
  );
  const startDate = String(formData.get("startDate") ?? "");
  const noEnd = formData.get("noEnd") === "on";
  const endDate = noEnd ? null : String(formData.get("endDate") ?? "") || null;
  const reminderEnabled = formData.get("reminderEnabled") === "on";
  const excludedWeekdays =
    recurrenceKind === "daily"
      ? formData.getAll("excludedWeekdays").map((v) => Number(v))
      : [];

  if (!taskName || !assigneeId || !startDate) {
    return { error: "Task name, assignee, and start date are required." };
  }

  // The assignee picker is already scoped to getAssignableEmployees() in the
  // UI, but that's client-supplied data -- re-check server-side so a
  // reporting_manager can't assign work to someone outside their reporting
  // chain by posting an arbitrary assigneeId.
  const assignable = await getAssignableEmployees(appUser);
  if (!assignable.some((e) => e.id === assigneeId)) {
    return { error: "You are not allowed to assign tasks to that person." };
  }

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      org_id: appUser.org_id,
      created_by: appUser.id,
      assignee_id: assigneeId,
      task_name: taskName,
      description: description || null,
      is_recurring: isRecurring,
      recurrence_kind: isRecurring ? recurrenceKind : "one_time",
      recurrence_interval: isRecurring ? recurrenceInterval : 1,
      excluded_weekdays: isRecurring && recurrenceKind === "daily" ? excludedWeekdays : [],
      start_date: startDate,
      end_date: endDate,
      reminder_enabled: reminderEnabled,
    })
    .select("id")
    .single();

  if (error || !task) {
    return { error: error?.message ?? "Could not create task." };
  }

  const { error: genError } = await supabase.rpc("generate_task_instances", {
    p_task_id: task.id,
  });
  if (genError) {
    return { error: `Task created, but scheduling failed: ${genError.message}` };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email")
    .eq("id", appUser.org_id)
    .single();
  const { data: assignee } = await supabase
    .from("app_users")
    .select("email, full_name")
    .eq("id", assigneeId)
    .single();
  if (org && assignee) {
    await sendOrgEmail(org, {
      to: assignee.email,
      subject: `New task assigned: ${taskName}`,
      html: `<p>Hi ${assignee.full_name},</p><p><strong>${taskName}</strong> has been assigned to you, starting ${fmtDate(startDate)}.</p>${description ? `<p>${description}</p>` : ""}`,
      notifType: "assigned",
    });
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export type CompleteState = { error: string | null };

export async function completeTaskInstance(
  _prev: CompleteState,
  formData: FormData
): Promise<CompleteState> {
  const appUser = await requireRole([
    "platform_owner",
    "master_admin",
    "reporting_manager",
    "user",
  ]);

  const instanceId = String(formData.get("instanceId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const file = formData.get("file");

  if (!instanceId) return { error: "Missing task instance." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Proof of completion is required." };
  }
  if (!appUser.org_id) return { error: "No organization on this account." };

  const supabase = await createClient();

  // Only the assignee can mark their own task complete -- the UI already
  // hides this form otherwise, but that's client-side; re-check here so a
  // POST with an arbitrary instanceId can't complete someone else's task.
  const { data: owned, error: ownerError } = await supabase
    .from("task_instances")
    .select("assignee_id")
    .eq("id", instanceId)
    .single();
  if (ownerError || !owned) return { error: "Task instance not found." };
  if (owned.assignee_id !== appUser.id) {
    return { error: "Only the assignee can mark this task complete." };
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${appUser.org_id}/${instanceId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  // The bucket is private -- store the storage path, not a public URL.
  // Callers resolve it to a short-lived signed URL at render time via
  // getAttachmentSignedUrl() in lib/attachments.ts.
  const { error } = await supabase
    .from("task_instances")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: appUser.id,
      comment: comment || null,
      attachment_url: path,
    })
    .eq("id", instanceId);

  if (error) return { error: error.message };

  const { data: instanceInfo } = await supabase
    .from("task_instances")
    .select(
      `assignee:app_users!task_instances_assignee_id_fkey(full_name),
       task:tasks!task_instances_task_id_fkey(task_name, created_by)`
    )
    .eq("id", instanceId)
    .single();
  const creatorId = instanceInfo?.task?.created_by;
  if (creatorId) {
    const [{ data: org }, { data: creator }] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email")
        .eq("id", appUser.org_id)
        .single(),
      supabase.from("app_users").select("email").eq("id", creatorId).single(),
    ]);
    if (org && creator) {
      const assigneeName = instanceInfo?.assignee?.full_name ?? "A teammate";
      const taskName = instanceInfo?.task?.task_name ?? "A task";
      await sendOrgEmail(org, {
        to: creator.email,
        subject: `Task completed: ${taskName}`,
        html: `<p>${assigneeName} marked <strong>${taskName}</strong> as complete.</p>${comment ? `<p>Comment: ${comment}</p>` : ""}`,
        notifType: "completed",
        taskInstanceId: instanceId,
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath(`/tasks/${instanceId}`);
  return { error: null };
}

export type DateChangeState = { error: string | null; success: boolean };

export async function requestDateChange(
  _prev: DateChangeState,
  formData: FormData
): Promise<DateChangeState> {
  const appUser = await requireRole([
    "platform_owner",
    "master_admin",
    "reporting_manager",
    "user",
  ]);

  const instanceId = String(formData.get("instanceId") ?? "");
  const newDate = String(formData.get("newDate") ?? "");
  if (!instanceId || !newDate) {
    return { error: "Pick a date to propose.", success: false };
  }
  if (!appUser.org_id) return { error: "No organization on this account.", success: false };

  const supabase = await createClient();

  // Per spec this never changes due_date directly -- it only notifies the
  // task creator, who can transfer/reschedule it themselves if they agree.
  const { data: instanceInfo } = await supabase
    .from("task_instances")
    .select(
      `due_date, assignee_id, assignee:app_users!task_instances_assignee_id_fkey(full_name),
       task:tasks!task_instances_task_id_fkey(task_name, created_by)`
    )
    .eq("id", instanceId)
    .single();
  if (!instanceInfo) return { error: "Task instance not found.", success: false };

  // Only the assignee can request a date change on their own task -- the UI
  // already hides this form otherwise, but re-check here since it's a
  // directly-callable server action.
  if (instanceInfo.assignee_id !== appUser.id) {
    return { error: "Only the assignee can request a date change.", success: false };
  }

  const creatorId = instanceInfo?.task?.created_by;
  if (creatorId) {
    const [{ data: org }, { data: creator }] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email")
        .eq("id", appUser.org_id)
        .single(),
      supabase.from("app_users").select("email").eq("id", creatorId).single(),
    ]);
    if (org && creator) {
      const assigneeName = instanceInfo?.assignee?.full_name ?? "A teammate";
      const taskName = instanceInfo?.task?.task_name ?? "A task";
      await sendOrgEmail(org, {
        to: creator.email,
        subject: `Date change requested: ${taskName}`,
        html: `<p>${assigneeName} requested moving <strong>${taskName}</strong> (currently due ${fmtDate(instanceInfo?.due_date ?? "")}) to ${fmtDate(newDate)}.</p><p>This hasn't been changed automatically -- transfer or otherwise update the task if you agree.</p>`,
        notifType: "date_change_requested",
        taskInstanceId: instanceId,
      });
    }
  }

  revalidatePath(`/tasks/${instanceId}`);
  return { error: null, success: true };
}
