import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database.types";
import type { Employee } from "@/lib/org-data";

export type TenantRow = Tables<"organizations"> & {
  adminEmail: string | null;
  userCount: number;
};

export async function getTenants(): Promise<TenantRow[]> {
  const supabase = await createClient();
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!orgs || orgs.length === 0) return [];

  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("org_id, email, system_role")
    .in(
      "org_id",
      orgs.map((o) => o.id)
    );
  if (usersError) throw usersError;

  return orgs.map((org) => {
    const orgUsers = (users ?? []).filter((u) => u.org_id === org.id);
    const admin = orgUsers.find((u) => u.system_role === "master_admin");
    return { ...org, adminEmail: admin?.email ?? null, userCount: orgUsers.length };
  });
}

export type PlatformStats = {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  usersByRole: Record<string, number>;
  billingCounts: Record<string, number>;
  totalSeats: number;
  seatsUsedPct: number;
  newTenantsLast30Days: number;
  tenantsNearLimit: { name: string; userCount: number; maxUsers: number }[];
};

/**
 * Platform-wide summary metrics for platform_owner's super-admin dashboard.
 * organizations and app_users both have an unconditional platform_owner
 * bypass in their SELECT RLS policies, so the regular client already sees
 * every tenant here -- no service-role client needed for these two reads.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const tenants = await getTenants();

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.is_active).length;
  const totalUsers = tenants.reduce((sum, t) => sum + t.userCount, 0);
  const totalSeats = tenants.reduce((sum, t) => sum + (t.max_users ?? 0), 0);
  const seatsUsedPct = totalSeats ? Math.round((totalUsers / totalSeats) * 100) : 0;

  const billingCounts: Record<string, number> = {};
  for (const t of tenants) {
    billingCounts[t.billing_status] = (billingCounts[t.billing_status] ?? 0) + 1;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newTenantsLast30Days = tenants.filter(
    (t) => t.created_at && t.created_at >= thirtyDaysAgo
  ).length;

  const tenantsNearLimit = tenants
    .filter((t) => t.max_users && t.userCount / t.max_users >= 0.8)
    .map((t) => ({ name: t.name, userCount: t.userCount, maxUsers: t.max_users ?? 0 }))
    .sort((a, b) => b.userCount / b.maxUsers - a.userCount / a.maxUsers);

  const supabase = await createClient();
  const { data: allUsers } = await supabase.from("app_users").select("system_role");
  const usersByRole: Record<string, number> = {};
  for (const u of allUsers ?? []) {
    usersByRole[u.system_role] = (usersByRole[u.system_role] ?? 0) + 1;
  }

  return {
    totalTenants,
    activeTenants,
    totalUsers,
    usersByRole,
    billingCounts,
    totalSeats,
    seatsUsedPct,
    newTenantsLast30Days,
    tenantsNearLimit,
  };
}

/**
 * Tenant-detail reads for platform_owner's per-tenant management page. Use
 * the service-role client uniformly here: `organizations` has a
 * platform_owner-wide RLS bypass, but `projects`/`designations` don't, so a
 * plain RLS-scoped client (current_org_id() is null for platform_owner)
 * would silently return nothing for those two.
 */
export async function getTenantById(orgId: string): Promise<Tables<"organizations"> | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("*").eq("id", orgId).single();
  if (error) return null;
  return data;
}

export async function getTenantUsers(orgId: string): Promise<Employee[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_users")
    .select(
      "id, full_name, email, system_role, project_id, designation_id, is_active, reports_to, project:projects(name)"
    )
    .eq("org_id", orgId)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    system_role: r.system_role,
    project_id: r.project_id,
    project_name: (r.project as { name: string } | null)?.name ?? null,
    designation_id: r.designation_id,
    is_active: r.is_active ?? true,
    reports_to: r.reports_to,
  }));
}

export async function getTenantManagers(orgId: string): Promise<Employee[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_users")
    .select("id, full_name, email, system_role, project_id, designation_id, is_active, reports_to")
    .eq("org_id", orgId)
    .eq("system_role", "reporting_manager")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, is_active: r.is_active ?? true, project_name: null }));
}

export async function getTenantProjects(orgId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTenantDesignations(orgId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("designations")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
