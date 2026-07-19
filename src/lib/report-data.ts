import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { delayDays, todayIso, fmtTime } from "@/lib/task-status";
import type { AppUser } from "@/lib/auth";

export type ReportRow = {
  instanceId: string;
  taskName: string;
  assignedDate: string;
  dueDate: string;
  completedDate: string | null;
  completedTime: string;
  delayInDays: number;
  status: string;
  evidencePath: string;
  comment: string;
  assigneeName: string;
  designation: string;
  project: string;
  organization: string;
  dateOfJoining: string;
};

export type ReportFilters = {
  /** Inclusive due-date lower bound, "YYYY-MM-DD". */
  dateFrom?: string;
  /** Inclusive due-date upper bound, "YYYY-MM-DD" -- clamped to today regardless. */
  dateTo?: string;
  /** Restrict to these due-date months, each "YYYY-MM". Empty/omitted = no month restriction. */
  months?: string[];
};

/** First-of-current-month through today -- the default report window so an
 * unfiltered visit doesn't scan the org's entire task history. */
export function currentMonthRange(): { from: string; to: string } {
  const today = todayIso();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

type RawRow = {
  id: string;
  created_at: string | null;
  due_date: string;
  completed_at: string | null;
  status: string | null;
  attachment_url: string | null;
  comment: string | null;
  task: { task_name: string; org_id: string | null } | null;
  assignee: {
    full_name: string;
    date_of_joining: string | null;
    designation: { name: string } | null;
    project: { name: string } | null;
  } | null;
};

const SELECT = `id, created_at, due_date, completed_at, status, attachment_url, comment,
     task:tasks!task_instances_task_id_fkey ( task_name, org_id ),
     assignee:app_users!task_instances_assignee_id_fkey (
       full_name, date_of_joining,
       designation:designations(name),
       project:projects(name)
     )`;

function mapRow(r: RawRow, orgName: string): ReportRow {
  return {
    instanceId: r.id,
    taskName: r.task!.task_name,
    assignedDate: r.created_at ?? "",
    dueDate: r.due_date,
    completedDate: r.completed_at,
    completedTime: fmtTime(r.completed_at),
    delayInDays: delayDays(r.due_date, r.completed_at),
    status: r.status ?? "pending",
    evidencePath: r.attachment_url ?? "",
    comment: r.comment ?? "",
    assigneeName: r.assignee!.full_name,
    designation: r.assignee!.designation?.name ?? "",
    project: r.assignee!.project?.name ?? "",
    organization: orgName,
    dateOfJoining: r.assignee!.date_of_joining ?? "",
  };
}

function endOfMonthIso(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
  return `${yyyyMM}-${String(lastDay).padStart(2, "0")}`;
}

/** Resolves the effective due-date bounds for a query -- always non-future,
 * defaulting to the current month when the caller doesn't specify. Selected
 * months take the date range's place, per spec ("date range must work in
 * accordance of month selected"); an explicit date range is used otherwise. */
function resolveRange(filters: ReportFilters): { from: string; to: string } {
  const today = todayIso();
  if (filters.months && filters.months.length > 0) {
    const sorted = [...filters.months].sort();
    const monthEnd = endOfMonthIso(sorted[sorted.length - 1]);
    return { from: `${sorted[0]}-01`, to: monthEnd > today ? today : monthEnd };
  }
  const defaults = currentMonthRange();
  const to = filters.dateTo && filters.dateTo < today ? filters.dateTo : today;
  const from = filters.dateFrom ?? defaults.from;
  return { from, to };
}

function applyFilters(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  const months = filters.months && filters.months.length > 0 ? new Set(filters.months) : null;
  if (!months) return rows;
  return rows.filter((r) => months.has(r.dueDate.slice(0, 7)));
}

/** Exposes the same range resolution the queries use, so pages can display
 * or pre-fill the effective (possibly defaulted) filter values. */
export function resolveReportRange(filters: ReportFilters): { from: string; to: string } {
  return resolveRange(filters);
}

/**
 * org-scoped report rows -- master_admin sees the whole org; "user" sees
 * only their own tasks; reporting_manager sees only tasks assigned to
 * people in their reporting chain (never the whole org). Scoping beyond
 * org isolation is enforced here in JS since RLS only isolates by org, not
 * by role/hierarchy.
 */
export async function getReportRows(
  appUser: AppUser,
  filters: ReportFilters = {}
): Promise<ReportRow[]> {
  const supabase = await createClient();
  const range = resolveRange(filters);

  let query = supabase
    .from("task_instances")
    .select(SELECT)
    .gte("due_date", range.from)
    .lte("due_date", range.to)
    .order("due_date", { ascending: false });
  if (appUser.system_role === "user") {
    query = query.eq("assignee_id", appUser.id);
  } else if (appUser.system_role === "reporting_manager") {
    const { data: chain, error: chainError } = await supabase.rpc("reporting_chain", {
      p_manager_id: appUser.id,
    });
    if (chainError) throw chainError;
    const reporteeIds = (chain ?? []).map((m) => m.id);
    if (reporteeIds.length === 0) return [];
    query = query.in("assignee_id", reporteeIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data ?? []) as unknown as RawRow[])
    .filter((r) => r.task && r.assignee)
    .map((r) => mapRow(r, ""));

  return applyFilters(rows, filters);
}

/**
 * Cross-tenant report rows for platform_owner. task_instances/tasks RLS has
 * no platform_owner bypass (only organizations/app_users do), so this goes
 * through the service-role client, same as the other platform-owner
 * cross-tenant reads.
 */
export async function getPlatformReportRows(filters: ReportFilters = {}): Promise<ReportRow[]> {
  const admin = createAdminClient();
  const range = resolveRange(filters);

  const [{ data, error }, { data: orgs, error: orgsError }] = await Promise.all([
    admin
      .from("task_instances")
      .select(SELECT)
      .gte("due_date", range.from)
      .lte("due_date", range.to)
      .order("due_date", { ascending: false }),
    admin.from("organizations").select("id, name"),
  ]);
  if (error) throw error;
  if (orgsError) throw orgsError;

  const orgNames = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const rows = ((data ?? []) as unknown as RawRow[])
    .filter((r) => r.task && r.assignee)
    .map((r) => mapRow(r, orgNames.get(r.task!.org_id ?? "") ?? "—"));

  return applyFilters(rows, filters);
}
