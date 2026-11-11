import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth";
import type { Enums } from "@/types/database.types";
import { bucketOf, todayIso } from "@/lib/task-status";

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
  assignee_manager_name: string | null;
  project_name: string | null;
};

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

export type BreakdownMode = "project" | "employee" | "designation" | "manager";
export type UserStatus = "active" | "inactive" | "all";

export type Kpis = {
  total: number;
  today: number;
  week: number;
  delayed: number;
  completed: number;
};

export type BreakdownRow = {
  label: string;
  total: number;
  completed: number;
  delayed: number;
  completedPct: number;
};

export type CalendarEntry = Pick<DashboardInstance, "id" | "due_date" | "status" | "task_name">;

export type DashboardData = {
  kpis: Kpis;
  uniqueTaskTotal: number;
  completionPct: number;
  breakdownRows: BreakdownRow[];
  /** One entry per task (see TaskGroup.representative). Empty for the calendar view. */
  taskGroups: TaskGroup[];
  /** Table view: tasks still open -- delayed or pending (due today, this week or later). */
  tableTaskGroups: TaskGroup[];
  calendar: CalendarEntry[];
  /** Months (YYYY-MM, newest first) that have tasks in scope. */
  availableMonths: string[];
};

const ID_PAGE = 1000;

/**
 * Who this viewer may see tasks for, narrowed by the screen's filter and by
 * whether to include active, inactive or all employees. `null` means "everyone
 * their organization's row-level security allows" (org admin, no filter, all
 * statuses). RLS only isolates by org, so a manager's reporting chain and an
 * employee's own tasks are enforced here, as before.
 */
export async function resolveAssigneeScope(
  appUser: AppUser,
  filterMode: string,
  filterValue: string,
  userStatus: UserStatus = "all"
): Promise<string[] | null> {
  const supabase = await createClient();
  const wantActive = userStatus === "active";
  const statusOk = (isActive: boolean | null) =>
    userStatus === "all" ? true : wantActive ? isActive !== false : isActive === false;

  if (appUser.system_role === "user") return [appUser.id];

  if (appUser.system_role === "reporting_manager") {
    const { data: chain, error } = await supabase.rpc("reporting_chain", {
      p_manager_id: appUser.id,
    });
    if (error) throw error;
    const reportees = chain ?? [];
    if (filterMode === "employee" && filterValue) {
      return reportees.some((r) => r.id === filterValue) ? [filterValue] : [];
    }
    let pool = reportees;
    if (filterMode === "project" && filterValue) pool = pool.filter((r) => r.project_id === filterValue);
    if (filterMode === "designation" && filterValue) pool = pool.filter((r) => r.designation_id === filterValue);
    return pool.filter((r) => statusOk(r.is_active)).map((r) => r.id);
  }

  // master_admin: the whole org unless filtered.
  if (filterMode === "employee" && filterValue) return [filterValue];
  const filtered = (filterMode === "project" || filterMode === "designation") && !!filterValue;
  if (!filtered && userStatus === "all") return null;

  const ids: string[] = [];
  for (let from = 0; ; from += ID_PAGE) {
    let query = supabase.from("app_users").select("id").order("id");
    if (filtered) {
      query =
        filterMode === "project"
          ? query.eq("project_id", filterValue)
          : query.eq("designation_id", filterValue);
    }
    if (userStatus === "active") query = query.neq("is_active", false);
    if (userStatus === "inactive") query = query.eq("is_active", false);
    const { data, error } = await query.range(from, from + ID_PAGE - 1);
    if (error) throw error;
    ids.push(...(data ?? []).map((u) => u.id));
    if ((data?.length ?? 0) < ID_PAGE) break;
  }
  return ids;
}

const PAGE = 1000; // the API returns at most this many rows per response

async function fetchTaskGroups(
  assigneeIds: string[] | null,
  from: string,
  to: string
): Promise<TaskGroup[]> {
  const supabase = await createClient();
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .rpc("dashboard_task_rows_window", { p_assignee_ids: assigneeIds, p_from: from, p_to: to })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
  }

  return rows.map((r) => {
    const representative: DashboardInstance = {
      id: r.id,
      task_id: r.task_id,
      due_date: r.due_date,
      status: r.status,
      completed_at: r.completed_at,
      comment: r.comment,
      attachment_url: r.attachment_url,
      assignee_id: r.assignee_id,
      original_assignee_id: r.original_assignee_id,
      task_name: r.task_name,
      description: r.description,
      is_recurring: r.is_recurring,
      recurrence_kind: r.recurrence_kind,
      reminder_enabled: r.reminder_enabled,
      assignee_name: r.assignee_name,
      assignee_role: r.assignee_role,
      assignee_manager_name: r.assignee_manager_name,
      project_name: r.project_name,
    };
    return {
      taskId: r.task_id,
      taskName: r.task_name,
      assigneeName: r.assignee_name,
      projectName: r.project_name,
      isRecurring: r.is_recurring,
      recurrenceKind: r.recurrence_kind,
      representative,
      instanceCount: r.instance_count,
    };
  });
}

async function fetchKpis(assigneeIds: string[] | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_kpis", {
    p_assignee_ids: assigneeIds,
    p_today: todayIso(),
  });
  if (error) throw error;
  const r = data?.[0];
  return {
    kpis: {
      total: r?.total_instances ?? 0,
      today: r?.due_today ?? 0,
      week: r?.due_week ?? 0,
      delayed: r?.delayed ?? 0,
      completed: r?.completed ?? 0,
    },
    uniqueTaskTotal: r?.unique_tasks ?? 0,
  };
}

async function fetchBreakdown(assigneeIds: string[] | null, mode: BreakdownMode): Promise<BreakdownRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_breakdown", {
    p_assignee_ids: assigneeIds,
    p_today: todayIso(),
    p_mode: mode,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    label: r.label,
    total: r.total,
    completed: r.completed,
    delayed: r.delayed,
    completedPct: r.total ? Math.round((r.completed / r.total) * 100) : 0,
  }));
}

async function fetchCalendar(assigneeIds: string[] | null, monthIso: string): Promise<CalendarEntry[]> {
  const [year, month] = monthIso.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_calendar", {
    p_assignee_ids: assigneeIds,
    p_from: `${monthIso}-01`,
    p_to: `${monthIso}-${String(lastDay).padStart(2, "0")}`,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    due_date: r.due_date,
    status: r.status,
    task_name: r.task_name,
  }));
}

/**
 * Everything the dashboard screens show, fetched in parallel and sized to
 * the active view: the database summarizes (counts, per-task rows, a month
 * of calendar entries) instead of the app downloading every instance.
 */
/**
 * The months (YYYY-MM) that actually have tasks in scope, newest first, for the
 * month filter. Falls back to an empty list if the database function is not
 * installed yet, in which case the caller shows only the current month.
 */
async function fetchTaskMonths(assigneeIds: string[] | null): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_task_months" as never, {
    p_assignee_ids: assigneeIds,
  } as never);
  if (error) return [];
  return ((data ?? []) as unknown as { month: string }[]).map((r) => r.month);
}

export async function loadDashboard(
  appUser: AppUser,
  opts: {
    view: string;
    filterMode: string;
    filterValue: string;
    breakdownMode: BreakdownMode;
    /** "YYYY-MM": the month the task list, board and calendar show. KPI tiles ignore it. */
    monthIso: string;
    /** Which employees' tasks the list, board, calendar and breakdown include (default: active). */
    userStatus: UserStatus;
    withBreakdown: boolean;
  }
): Promise<DashboardData> {
  // KPI tiles keep counting everyone in scope, as before; everything below
  // them follows the active/inactive choice.
  const kpiIds = await resolveAssigneeScope(appUser, opts.filterMode, opts.filterValue, "all");
  const dataIds =
    opts.userStatus === "all"
      ? kpiIds
      : await resolveAssigneeScope(appUser, opts.filterMode, opts.filterValue, opts.userStatus);

  const emptyKpis = { kpis: { total: 0, today: 0, week: 0, delayed: 0, completed: 0 }, uniqueTaskTotal: 0 };
  const noData = !!dataIds && dataIds.length === 0;

  const [year, month] = opts.monthIso.split("-").map(Number);
  const from = `${opts.monthIso}-01`;
  const to = `${opts.monthIso}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const wantsGroups = opts.view === "table" || opts.view === "kanban";
  const [summary, taskGroups, breakdownRows, calendar, availableMonths] = await Promise.all([
    kpiIds && kpiIds.length === 0 ? Promise.resolve(emptyKpis) : fetchKpis(kpiIds),
    wantsGroups && !noData ? fetchTaskGroups(dataIds, from, to) : Promise.resolve([] as TaskGroup[]),
    opts.withBreakdown && !noData ? fetchBreakdown(dataIds, opts.breakdownMode) : Promise.resolve([] as BreakdownRow[]),
    opts.view === "calendar" && !noData ? fetchCalendar(dataIds, opts.monthIso) : Promise.resolve([] as CalendarEntry[]),
    kpiIds && kpiIds.length === 0 ? Promise.resolve([] as string[]) : fetchTaskMonths(kpiIds),
  ]);

  // Table view: only open work -- delayed and pending -- never the completed history.
  const tableTaskGroups = taskGroups.filter((t) => bucketOf(t.representative) !== "completed");

  const { kpis, uniqueTaskTotal } = summary;
  return {
    kpis,
    uniqueTaskTotal,
    completionPct: kpis.total ? Math.round((kpis.completed / kpis.total) * 100) : 0,
    breakdownRows,
    taskGroups,
    tableTaskGroups,
    calendar,
    availableMonths,
  };
}
