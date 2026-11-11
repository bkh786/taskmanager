import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth";

export type Employee = {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  system_role: AppUser["system_role"];
  project_id: string | null;
  project_name: string | null;
  designation_id: string | null;
  is_active: boolean;
  reports_to: string | null;
  /** Filled in by the user-management listings (getOrgUsers / getTenantUsers). */
  designation_name?: string | null;
  manager_name?: string | null;
};

/**
 * Employees a manager can assign tasks to / manage: their reporting chain
 * (direct + indirect reportees) per the "manages within their reporting
 * chain" rule. master_admin/platform_owner get the whole org instead, since
 * they have full tenant control.
 */
export async function getAssignableEmployees(
  appUser: AppUser,
  opts: { includeInactive?: boolean } = {}
): Promise<Employee[]> {
  const supabase = await createClient();

  if (appUser.system_role === "reporting_manager") {
    const { data, error } = await supabase.rpc("reporting_chain", {
      p_manager_id: appUser.id,
    });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];

    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const projectNames = await getProjectNameMap(projectIds);

    return rows
      .filter((r) => opts.includeInactive || r.is_active)
      .map((r) => ({
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        employee_code: r.employee_code,
        system_role: r.system_role,
        project_id: r.project_id,
        project_name: r.project_id ? (projectNames.get(r.project_id) ?? null) : null,
        designation_id: r.designation_id,
        is_active: r.is_active,
        reports_to: null,
      }));
  }

  // master_admin / platform_owner (platform_owner has no org_id, but this
  // path is only reached for org-scoped roles in practice): full org.
  let query = supabase
    .from("app_users")
    .select(
      "id, full_name, email, employee_code, system_role, project_id, designation_id, is_active, reports_to, project:projects(name)"
    )
    .eq("org_id", appUser.org_id ?? "")
    .neq("system_role", "master_admin")
    .order("full_name");
  if (!opts.includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    employee_code: r.employee_code,
    system_role: r.system_role,
    project_id: r.project_id,
    project_name: (r.project as { name: string } | null)?.name ?? null,
    designation_id: r.designation_id,
    is_active: r.is_active ?? true,
    reports_to: r.reports_to,
  }));
}

async function getProjectNameMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

/**
 * Full user-management listing (unlike getAssignableEmployees, this
 * includes inactive users and other master_admins -- it's for the User
 * Management page, not task-assignee pickers).
 */
export async function getOrgUsers(appUser: AppUser): Promise<Employee[]> {
  const supabase = await createClient();

  if (appUser.system_role === "reporting_manager") {
    const { data, error } = await supabase.rpc("reporting_chain", {
      p_manager_id: appUser.id,
    });
    if (error) throw error;
    const rows = data ?? [];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const projectNames = await getProjectNameMap(projectIds);

    // The reporting-chain function doesn't return who each person reports to
    // or their designation name, so look those up for just these people.
    const ids = rows.map((r) => r.id);
    const { data: extra } = ids.length
      ? await supabase
          .from("app_users")
          .select("id, reports_to, designation:designations(name)")
          .in("id", ids)
      : { data: [] };
    const extraById = new Map((extra ?? []).map((e) => [e.id, e]));
    const managerIds = [
      ...new Set((extra ?? []).map((e) => e.reports_to).filter((id): id is string => !!id)),
    ];
    const { data: managers } = managerIds.length
      ? await supabase.from("app_users").select("id, full_name").in("id", managerIds)
      : { data: [] };
    const managerNames = new Map((managers ?? []).map((m) => [m.id, m.full_name]));

    return rows.map((r) => {
      const e = extraById.get(r.id);
      return {
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        employee_code: r.employee_code,
        system_role: r.system_role,
        project_id: r.project_id,
        project_name: r.project_id ? (projectNames.get(r.project_id) ?? null) : null,
        designation_id: r.designation_id,
        is_active: r.is_active,
        reports_to: e?.reports_to ?? null,
        designation_name: (e?.designation as { name: string } | null)?.name ?? null,
        manager_name: e?.reports_to ? (managerNames.get(e.reports_to) ?? null) : null,
      };
    });
  }

  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, employee_code, system_role, project_id, designation_id, is_active, reports_to, project:projects(name), designation:designations(name)"
    )
    .eq("org_id", appUser.org_id ?? "")
    .order("full_name");
  if (error) throw error;

  const rows = data ?? [];
  // Self-referencing joins aren't supported by the API, but this list already
  // holds everyone in the org, so manager names come from it.
  const nameById = new Map(rows.map((r) => [r.id, r.full_name]));
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    employee_code: r.employee_code,
    system_role: r.system_role,
    project_id: r.project_id,
    project_name: (r.project as { name: string } | null)?.name ?? null,
    designation_id: r.designation_id,
    is_active: r.is_active ?? true,
    reports_to: r.reports_to,
    designation_name: (r.designation as { name: string } | null)?.name ?? null,
    manager_name: r.reports_to ? (nameById.get(r.reports_to) ?? null) : null,
  }));
}

export async function getOrgManagers(orgId: string): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, employee_code, system_role, project_id, designation_id, is_active, reports_to"
    )
    .eq("org_id", orgId)
    .eq("system_role", "reporting_manager")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, is_active: r.is_active ?? true, project_name: null }));
}

export async function getOrgProjects(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** A designation and (optionally) the designation its holders report to. */
export type DesignationItem = {
  id: string;
  name: string;
  reports_to_designation_id: string | null;
  /** Alternative to a designation: the designation reports to anyone holding this system role. */
  reports_to_role: "master_admin" | "reporting_manager" | null;
};

export async function getOrgDesignations(orgId: string): Promise<DesignationItem[]> {
  const supabase = await createClient();
  // select("*"): keeps working before the hierarchy column has been added.
  const { data, error } = await supabase
    .from("designations")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    reports_to_designation_id: d.reports_to_designation_id ?? null,
    reports_to_role: (d.reports_to_role as DesignationItem["reports_to_role"]) ?? null,
  }));
}

export type SourceTask = {
  id: string;
  task_name: string;
  is_recurring: boolean;
  recurrence_kind: string;
};

export async function getUserActiveTasks(userId: string): Promise<SourceTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_name, is_recurring, recurrence_kind")
    .eq("assignee_id", userId)
    .eq("is_active", true)
    .order("task_name");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    task_name: t.task_name,
    is_recurring: t.is_recurring ?? false,
    recurrence_kind: t.recurrence_kind ?? "one_time",
  }));
}
