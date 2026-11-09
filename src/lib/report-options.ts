import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/auth";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ReportPerson = {
  id: string;
  name: string;
  projectId: string | null;
  designationId: string | null;
  role: AppUser["system_role"];
};

/** Everything the report filter bar needs to offer inter-dependent choices. */
export type ReportOptions = {
  /** People whose tasks can appear in the report (the assignees). */
  people: ReportPerson[];
  projects: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  /** People who have assigned tasks to anyone in `people`. */
  assigners: { id: string; name: string }[];
  /** [assignerId, assigneeId] pairs, so "Assigned by" can narrow with the other filters. */
  links: [string, string][];
};

const PAGE = 1000;
const USER_COLS = "id, full_name, project_id, designation_id, system_role";

type UserRow = {
  id: string;
  full_name: string;
  project_id: string | null;
  designation_id: string | null;
  system_role: AppUser["system_role"];
};

async function allUsers(client: Client, orgId: string | null): Promise<UserRow[]> {
  const out: UserRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.from("app_users").select(USER_COLS).order("id");
    q = orgId ? q.eq("org_id", orgId) : q.neq("system_role", "platform_owner");
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as UserRow[]));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return out;
}

async function build(client: Client, scopeUsers: UserRow[]): Promise<ReportOptions> {
  const scopeIds = new Set(scopeUsers.map((u) => u.id));

  // Distinct (creator, assignee) pairs from the task templates.
  const pairs = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("tasks")
      .select("assignee_id, created_by")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const t of data ?? []) {
      if (t.assignee_id && t.created_by && scopeIds.has(t.assignee_id)) {
        pairs.add(`${t.created_by}|${t.assignee_id}`);
      }
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  const links = [...pairs].map((p) => p.split("|") as [string, string]);
  const assignerIds = [...new Set(links.map((l) => l[0]))];

  const [{ data: projects }, { data: designations }] = await Promise.all([
    client.from("projects").select("id, name").order("name"),
    client.from("designations").select("id, name").order("name"),
  ]);

  const nameById = new Map(scopeUsers.map((u) => [u.id, u.full_name]));
  const missing = assignerIds.filter((id) => !nameById.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const { data } = await client
      .from("app_users")
      .select("id, full_name")
      .in("id", missing.slice(i, i + 100));
    for (const u of data ?? []) nameById.set(u.id, u.full_name);
  }

  const usedProjects = new Set(scopeUsers.map((u) => u.project_id).filter(Boolean));
  const usedDesignations = new Set(scopeUsers.map((u) => u.designation_id).filter(Boolean));

  return {
    people: scopeUsers.map((u) => ({
      id: u.id,
      name: u.full_name,
      projectId: u.project_id,
      designationId: u.designation_id,
      role: u.system_role,
    })),
    projects: (projects ?? []).filter((p) => usedProjects.has(p.id)),
    designations: (designations ?? []).filter((d) => usedDesignations.has(d.id)),
    assigners: assignerIds
      .filter((id) => nameById.has(id))
      .map((id) => ({ id, name: nameById.get(id)! }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    links,
  };
}

export async function getReportOptions(appUser: AppUser): Promise<ReportOptions> {
  const supabase = await createClient();

  let scope: UserRow[];
  if (appUser.system_role === "user") {
    const { data, error } = await supabase
      .from("app_users")
      .select(USER_COLS)
      .eq("id", appUser.id);
    if (error) throw error;
    scope = (data ?? []) as UserRow[];
  } else if (appUser.system_role === "reporting_manager") {
    const { data, error } = await supabase.rpc("reporting_chain", { p_manager_id: appUser.id });
    if (error) throw error;
    scope = (data ?? []).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      project_id: r.project_id,
      designation_id: r.designation_id,
      system_role: r.system_role,
    }));
  } else {
    scope = await allUsers(supabase, appUser.org_id);
  }
  return build(supabase, scope);
}

/** Cross-tenant options for platform_owner (service-role, like the report itself). */
export async function getPlatformReportOptions(): Promise<ReportOptions> {
  const admin = createAdminClient() as unknown as Client;
  return build(admin, await allUsers(admin, null));
}
