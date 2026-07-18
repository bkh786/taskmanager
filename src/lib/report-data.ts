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

function applyFilters(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  const dateTo = filters.dateTo && filters.dateTo < todayIso() ? filters.dateTo : todayIso();
  const dateFrom = filters.dateFrom ?? null;
  const months = filters.months && filters.months.length > 0 ? new Set(filters.months) : null;

  return rows.filter((r) => {
    if (r.dueDate > dateTo) return false; // future tasks are never included
    if (dateFrom && r.dueDate < dateFrom) return false;
    if (months && !months.has(r.dueDate.slice(0, 7))) return false;
    return true;
  });
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

  let query = supabase.from("task_instances").select(SELECT).order("due_date", { ascending: false });
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

  const [{ data, error }, { data: orgs, error: orgsError }] = await Promise.all([
    admin.from("task_instances").select(SELECT).order("due_date", { ascending: false }),
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
