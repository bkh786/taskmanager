import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth";
import type { Enums } from "@/types/database.types";
import { bucketOf } from "@/lib/task-status";

export type DashboardInstance = {
  id: string;
  task_id: string;
  due_date: string;
  status: "pending" | "completed" | "delayed" | "removed" | null;
  completed_at: string | null;
  comment: string | null;
  attachment_url: string | null;
  assignee_id: string | null;
  original_assignee_id: string | null;
  task_name: string;
  description: string | null;
  is_recurring: boolean;
  recurrence_kind: Enums<"recurrence_kind">;
  reminder_enabled: boolean;
  assignee_name: string;
  assignee_role: AppUser["system_role"] | null;
  project_name: string | null;
};

type RawRow = {
  id: string;
  task_id: string | null;
  due_date: string;
  status: DashboardInstance["status"];
  completed_at: string | null;
  comment: string | null;
  attachment_url: string | null;
  assignee_id: string | null;
  original_assignee_id: string | null;
  task: {
    task_name: string;
    description: string | null;
    is_recurring: boolean | null;
    recurrence_kind: Enums<"recurrence_kind"> | null;
    reminder_enabled: boolean | null;
  } | null;
  assignee: {
    full_name: string;
    system_role: AppUser["system_role"];
    project: { name: string } | null;
  } | null;
};

/**
 * Fetches all non-removed task instances the caller can see (RLS already
 * scopes by org; "user" role is additionally narrowed to their own here).
 * Dataset is org-scoped, not paginated -- fine at this app's expected scale.
 */
export async function getDashboardInstances(
  appUser: AppUser
): Promise<DashboardInstance[]> {
  const supabase = await createClient();

  let query = supabase
    .from("task_instances")
    .select(
      `id, task_id, due_date, status, completed_at, comment, attachment_url,
       assignee_id, original_assignee_id,
       task:tasks!task_instances_task_id_fkey ( task_name, description, is_recurring, recurrence_kind, reminder_enabled ),
       assignee:app_users!task_instances_assignee_id_fkey ( full_name, system_role, project:projects(name) )`
    )
    .eq("removed", false)
    .order("due_date", { ascending: true });

  if (appUser.system_role === "user") {
    query = query.eq("assignee_id", appUser.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as RawRow[])
    .filter((r) => r.task && r.assignee)
    .map((r) => ({
      id: r.id,
      task_id: r.task_id!,
      due_date: r.due_date,
      status: r.status,
      completed_at: r.completed_at,
      comment: r.comment,
      attachment_url: r.attachment_url,
      assignee_id: r.assignee_id,
      original_assignee_id: r.original_assignee_id,
      task_name: r.task!.task_name,
      description: r.task!.description,
      is_recurring: !!r.task!.is_recurring,
      recurrence_kind: r.task!.recurrence_kind ?? "one_time",
      reminder_enabled: !!r.task!.reminder_enabled,
      assignee_name: r.assignee!.full_name,
      assignee_role: r.assignee!.system_role,
      project_name: r.assignee!.project?.name ?? null,
    }));
}

export function computeKpis(instances: DashboardInstance[]) {
  let today = 0,
    week = 0,
    delayed = 0,
    completed = 0;
  for (const i of instances) {
    const b = bucketOf(i);
    if (b === "today") today++;
    else if (b === "week") week++;
    else if (b === "delayed") delayed++;
    else if (b === "completed") completed++;
  }
  return { total: instances.length, today, week, delayed, completed };
}

/** Distinct tasks behind a set of instances -- a weekly task with 9
 * upcoming occurrences is still one task, not nine. */
export function uniqueTaskCount(instances: DashboardInstance[]): number {
  return new Set(instances.map((i) => i.task_id)).size;
}

export type TaskGroup = {
  taskId: string;
  taskName: string;
  assigneeName: string;
  projectName: string | null;
  isRecurring: boolean;
  recurrenceKind: Enums<"recurrence_kind">;
  /** The instance used to represent this task's row/card: the earliest
   * still-open (non-completed) occurrence, or -- if every occurrence is
   * already completed -- the most recently completed one. */
  representative: DashboardInstance;
  instanceCount: number;
};

/**
 * Collapses instance-level rows down to one entry per underlying task, for
 * views (Table, Kanban) that should show "this recurring task is next due
 * Tuesday" rather than a separate row for every future occurrence.
 */
export function groupInstancesByTask(instances: DashboardInstance[]): TaskGroup[] {
  const byTask = new Map<string, DashboardInstance[]>();
  for (const i of instances) {
    if (!byTask.has(i.task_id)) byTask.set(i.task_id, []);
    byTask.get(i.task_id)!.push(i);
  }

  const groups: TaskGroup[] = [];
  for (const group of byTask.values()) {
    const open = group
      .filter((i) => i.status !== "completed")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const representative =
      open[0] ??
      [...group].sort((a, b) =>
        (b.completed_at ?? b.due_date).localeCompare(a.completed_at ?? a.due_date)
      )[0];

    groups.push({
      taskId: representative.task_id,
      taskName: representative.task_name,
      assigneeName: representative.assignee_name,
      projectName: representative.project_name,
      isRecurring: representative.is_recurring,
      recurrenceKind: representative.recurrence_kind,
      representative,
      instanceCount: group.length,
    });
  }

  return groups.sort((a, b) => a.representative.due_date.localeCompare(b.representative.due_date));
}

export type BreakdownMode = "project" | "employee" | "role";

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

export function computeBreakdown(
  instances: DashboardInstance[],
  mode: BreakdownMode
) {
  const groups = new Map<string, DashboardInstance[]>();
  for (const i of instances) {
    const key =
      mode === "project"
        ? (i.project_name ?? "No project")
        : mode === "employee"
          ? i.assignee_name
          : ROLE_LABELS[i.assignee_role ?? "user"];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }
  return Array.from(groups.entries())
    .map(([label, rows]) => {
      const total = rows.length;
      const completed = rows.filter((r) => bucketOf(r) === "completed").length;
      const delayed = rows.filter((r) => bucketOf(r) === "delayed").length;
      return {
        label,
        total,
        completed,
        delayed,
        completedPct: total ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}
