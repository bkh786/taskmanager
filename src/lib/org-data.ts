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
};

/**
 * Employees a manager can assign tasks to / manage: their reporting chain
 * (direct + indirect reportees) per the "manages within their reporting
 * chain" rule. master_admin/platform_owner get the whole org instead, since
 * they have full tenant control.
 */
export async function getAssignableEmployees(
  appUser: AppUser
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
      .filter((r) => r.is_active)
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
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, employee_code, system_role, project_id, designation_id, is_active, reports_to, project:projects(name)"
    )
    .eq("org_id", appUser.org_id ?? "")
    .eq("is_active", true)
    .neq("system_role", "master_admin")
    .order("full_name");
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
    return rows.map((r) => ({
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

  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, employee_code, system_role, project_id, designation_id, is_active, reports_to, project:projects(name)"
    )
    .eq("org_id", appUser.org_id ?? "")
    .order("full_name");
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

export async function getOrgDesignations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("designations")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
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
