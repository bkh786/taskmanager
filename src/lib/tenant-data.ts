import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

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
