"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TenantFormState = { error: string | null };

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

export async function createTenant(
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const platformOwner = await requireRole(["platform_owner"]);

  const orgName = String(formData.get("orgName") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  const adminName = String(formData.get("adminName") ?? "").trim();
  const plan = String(formData.get("plan") ?? "Starter");
  const maxUsersRaw = String(formData.get("maxUsers") ?? "");
  const maxUsers = maxUsersRaw ? Math.max(1, Number(maxUsersRaw)) : null;
  const projectName = String(formData.get("projectName") ?? "").trim();
  const status = String(formData.get("status") ?? "Active");
  const useInactiveDate = formData.get("useInactiveDate") === "on";
  const inactiveDate = useInactiveDate
    ? String(formData.get("inactiveDate") ?? "") || null
    : null;
  const billingStatus = String(formData.get("billingStatus") ?? "Trial");

  if (!orgName || !adminEmail || !adminName) {
    return { error: "Organization name, admin name, and admin email are required." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  let slug = slugify(orgName);
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      slug,
      plan,
      max_users: maxUsers,
      billing_status: billingStatus,
      is_active: status === "Active",
      auto_deactivate_date: inactiveDate,
    })
    .select("id")
    .single();
  if (orgError || !org) {
    return { error: orgError?.message ?? "Could not create the organization." };
  }

  if (projectName) {
    await supabase.from("projects").insert({ org_id: org.id, name: projectName });
  }

  // Admin API invite -- sends Supabase's own invite email (magic link to set
  // a password), independent of the org's not-yet-configured SMTP settings.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    adminEmail
  );
  if (inviteError || !invited.user) {
    return {
      error: `Organization created, but inviting the admin failed: ${inviteError?.message ?? "unknown error"}.`,
    };
  }

  const { error: appUserError } = await supabase.from("app_users").insert({
    id: invited.user.id,
    org_id: org.id,
    system_role: "master_admin",
    full_name: adminName,
    email: adminEmail,
    created_by: platformOwner.id,
  });
  if (appUserError) {
    return { error: appUserError.message };
  }

  revalidatePath("/tenants");
  return { error: null };
}
