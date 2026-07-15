import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type AppUser = Tables<"app_users">;

/**
 * Resolves the signed-in user's app_users row.
 *
 * Relies on the app_users_select RLS policy's self-lookup subquery
 * (org_id = (select org_id from app_users where id = auth.uid())), which
 * Postgres resolves as a single-row equality check against the caller's own
 * row -- not recursive. Deliberately NOT using the service-role client here:
 * per the multi-tenancy rule, service role is reserved for the reminder cron
 * and platform-owner admin actions, not routine per-request profile lookups.
 */
export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data;
}

export function roleHome(role: AppUser["system_role"]): string {
  switch (role) {
    case "platform_owner":
      return "/tenants";
    case "master_admin":
      return "/org-settings";
    case "reporting_manager":
    case "user":
      return "/dashboard";
  }
}

/** Redirects to /login if unauthenticated, or to the user's home if their role can't access the current route. */
export async function requireRole(
  allowed: Array<AppUser["system_role"]>
): Promise<AppUser> {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  if (!allowed.includes(appUser.system_role)) redirect(roleHome(appUser.system_role));
  return appUser;
}
