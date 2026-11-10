"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { appBaseUrl, sendOrgEvent } from "@/lib/email";
import { parseEmailList } from "@/lib/email-events";
import { fmtDate } from "@/lib/task-status";
import { getAssignableEmployees } from "@/lib/org-data";
import {
  B2_PREFIX,
  MAX_ATTACHMENT_BYTES,
  headObject,
  deleteObject,
} from "@/lib/b2";
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
  const notifyOnComplete = formData.get("notifyOnComplete") === "on";
  const notificationCcList = parseEmailList(String(formData.get("notificationCc") ?? ""));
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
      notify_on_complete: notifyOnComplete,
      notification_cc: notificationCcList.length ? notificationCcList.join(", ") : null,
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

  // The assignee is emailed in the background so the form returns immediately.
  if (assigneeId !== appUser.id) {
    const orgId = appUser.org_id;
    const assignedBy = appUser.full_name;
    const [{ data: assignee }, { data: firstInstance }] = await Promise.all([
      supabase.from("app_users").select("email, full_name").eq("id", assigneeId).single(),
      supabase
        .from("task_instances")
        .select("id")
        .eq("task_id", task.id)
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    if (assignee) {
      const schedule = isRecurring
        ? `${recurrenceKind[0].toUpperCase()}${recurrenceKind.slice(1)}${recurrenceInterval > 1 ? ` (every ${recurrenceInterval})` : ""}`
        : "One-time";
      after(() =>
        sendOrgEvent({
          orgId,
          event: "task_assigned",
          to: assignee.email,
          taskInstanceId: firstInstance?.id ?? null,
          extraCc: notificationCcList,
          vars: {
            assignee_name: assignee.full_name,
            task_name: taskName,
            description: description || "",
            start_date: fmtDate(startDate),
            schedule,
            assigned_by: assignedBy,
            task_link: firstInstance ? `${appBaseUrl()}/tasks/${firstInstance.id}` : appBaseUrl(),
          },
        })
      );
    }
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
  const attachmentKey = String(formData.get("attachmentKey") ?? "");

  if (!instanceId) return { error: "Missing task instance." };
  if (!attachmentKey) return { error: "Proof of completion is required." };
  if (!appUser.org_id) return { error: "No organization on this account." };

  // The browser uploaded straight to B2 using a URL from /api/attachments/upload-url;
  // never trust the key it hands back -- it must sit under this org + instance
  // and actually exist within the allowed size.
  if (!attachmentKey.startsWith(`${appUser.org_id}/${instanceId}/`)) {
    return { error: "Invalid attachment." };
  }
  const stored = await headObject(attachmentKey);
  if (!stored) return { error: "Upload not found -- please try attaching the file again." };
  if (stored.size > MAX_ATTACHMENT_BYTES) {
    await deleteObject(attachmentKey);
    return { error: "File is too large." };
  }

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

  // The bucket is private -- store the object key (B2_PREFIX marks it as B2
  // rather than a legacy Supabase Storage path), not a public URL. Callers
  // resolve it to a short-lived signed URL at render time via
  // getAttachmentSignedUrl() in lib/attachments.ts.
  const { error } = await supabase
    .from("task_instances")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: appUser.id,
      comment: comment || null,
      attachment_url: `${B2_PREFIX}${attachmentKey}`,
    })
    .eq("id", instanceId);

  if (error) return { error: error.message };

  // Tell the task's creator (unless they switched that off for this task, or
  // they are the one completing it) -- in the background so the form returns at once.
  const { data: instanceInfo } = await supabase
    .from("task_instances")
    .select(
      `due_date, assignee:app_users!task_instances_assignee_id_fkey(full_name),
       task:tasks!task_instances_task_id_fkey(task_name, created_by, notify_on_complete, notification_cc)`
    )
    .eq("id", instanceId)
    .single();
  const task = instanceInfo?.task;
  const creatorId = task?.created_by;
  if (task && creatorId && creatorId !== appUser.id && task.notify_on_complete !== false) {
    const { data: creator } = await supabase
      .from("app_users")
      .select("email, full_name")
      .eq("id", creatorId)
      .single();
    if (creator) {
      const orgId = appUser.org_id;
      const vars = {
        creator_name: creator.full_name,
        assignee_name: instanceInfo?.assignee?.full_name ?? "A teammate",
        task_name: task.task_name,
        due_date: fmtDate(instanceInfo?.due_date ?? ""),
        comment: comment || "(no comment)",
        task_link: `${appBaseUrl()}/tasks/${instanceId}`,
      };
      after(() =>
        sendOrgEvent({
          orgId,
          event: "task_completed",
          to: creator.email,
          subjectEmail: appUser.email,
          taskInstanceId: instanceId,
          extraCc: parseEmailList(task.notification_cc),
          vars,
        })
      );
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

  const creatorId = instanceInfo.task?.created_by;
  if (creatorId && creatorId !== appUser.id) {
    const { data: creator } = await supabase
      .from("app_users")
      .select("email, full_name")
      .eq("id", creatorId)
      .single();
    if (creator) {
      const orgId = appUser.org_id;
      const vars = {
        creator_name: creator.full_name,
        assignee_name: instanceInfo.assignee?.full_name ?? "A teammate",
        task_name: instanceInfo.task?.task_name ?? "A task",
        due_date: fmtDate(instanceInfo.due_date),
        proposed_date: fmtDate(newDate),
        task_link: `${appBaseUrl()}/tasks/${instanceId}`,
      };
      after(() =>
        sendOrgEvent({
          orgId,
          event: "date_change_requested",
          to: creator.email,
          subjectEmail: appUser.email,
          taskInstanceId: instanceId,
          vars,
        })
      );
    }
  }

  revalidatePath(`/tasks/${instanceId}`);
  return { error: null, success: true };
}
