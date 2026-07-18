"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/task-status";
import { getAssignableEmployees } from "@/lib/org-data";

export type CopyState = { error: string | null; copied: number };

export async function copyTasks(
  _prev: CopyState,
  formData: FormData
): Promise<CopyState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  if (!appUser.org_id) return { error: "No organization on this account.", copied: 0 };

  const taskIds = formData.getAll("taskIds").map(String);
  const targetIds = formData.getAll("targetIds").map(String);

  if (taskIds.length === 0) return { error: "Pick at least one task to copy.", copied: 0 };
  if (targetIds.length === 0) return { error: "Pick at least one teammate to copy to.", copied: 0 };

  // The source/target pickers are already scoped to getAssignableEmployees()
  // in the UI, but taskIds/targetIds still arrive as plain form values --
  // re-check server-side so a reporting_manager can't copy an arbitrary org
  // member's tasks to an arbitrary org member outside their reporting chain.
  const assignableIds = new Set((await getAssignableEmployees(appUser)).map((e) => e.id));
  if (!targetIds.every((id) => assignableIds.has(id))) {
    return { error: "You are not allowed to assign tasks to that person.", copied: 0 };
  }

  const supabase = await createClient();
  const { data: sourceTasks, error: fetchError } = await supabase
    .from("tasks")
    .select(
      "assignee_id, task_name, description, is_recurring, recurrence_kind, recurrence_interval, start_date, end_date, reminder_enabled"
    )
    .in("id", taskIds);
  if (fetchError) return { error: fetchError.message, copied: 0 };
  if (!sourceTasks || sourceTasks.length === 0) {
    return { error: "Selected tasks not found.", copied: 0 };
  }
  if (!sourceTasks.every((t) => t.assignee_id && assignableIds.has(t.assignee_id))) {
    return { error: "You can only copy tasks within your reporting chain.", copied: 0 };
  }

  const today = todayIso();
  let copied = 0;

  for (const task of sourceTasks) {
    // Preserve the recurrence pattern, but don't backfill past due dates for
    // the new assignee -- start from today (or the original start date if
    // it's still upcoming).
    const startDate = task.start_date > today ? task.start_date : today;
    if (task.end_date && task.end_date < startDate) continue; // fully expired, skip

    for (const targetId of targetIds) {
      const { data: newTask, error: insertError } = await supabase
        .from("tasks")
        .insert({
          org_id: appUser.org_id,
          created_by: appUser.id,
          assignee_id: targetId,
          task_name: task.task_name,
          description: task.description,
          is_recurring: task.is_recurring,
          recurrence_kind: task.recurrence_kind,
          recurrence_interval: task.recurrence_interval,
          start_date: startDate,
          end_date: task.end_date,
          reminder_enabled: task.reminder_enabled,
        })
        .select("id")
        .single();
      if (insertError || !newTask) continue;

      await supabase.rpc("generate_task_instances", { p_task_id: newTask.id });
      copied++;
    }
  }

  if (copied > 0) revalidatePath("/dashboard");
  return { error: null, copied };
}
