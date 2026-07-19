"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type AppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgContext } from "@/lib/org-context";

export type UserFormState = { error: string | null };

const CREATABLE_ROLES: Record<AppUser["system_role"], AppUser["system_role"][]> = {
  master_admin: ["master_admin", "reporting_manager", "user"],
  platform_owner: ["master_admin", "reporting_manager", "user"],
  reporting_manager: [],
  user: [],
};

export async function createOrReplaceUser(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "user") as AppUser["system_role"];
  const mode = String(formData.get("mode") ?? "new_hire"); // "new_hire" | "replacing"
  const replacingUserId = String(formData.get("replacingUserId") ?? "");
  const reportsTo = String(formData.get("reportsTo") ?? "") || null;

  if (!fullName || !email || !password || !employeeCode) {
    return { error: "Name, email, employee code, and a default password are required." };
  }
  if (password.length < 8) {
    return { error: "Default password must be at least 8 characters." };
  }
  if (!CREATABLE_ROLES[appUser.system_role].includes(role)) {
    return { error: "You are not allowed to assign that role." };
  }
  if (mode === "replacing" && !replacingUserId) {
    return { error: "Pick who this person is replacing." };
  }

  const admin = createAdminClient();
  const supabase = ctx.client ?? (await createClient());

  // Auth user creation only works via the Admin API (service role) -- there
  // is no RLS-scoped equivalent. Authorization was already checked above.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "Could not create the account." };
  }

  const { error: insertError } = await supabase.from("app_users").insert({
    id: created.user.id,
    org_id: orgId,
    system_role: role,
    full_name: fullName,
    email,
    employee_code: employeeCode,
    reports_to: reportsTo,
    created_by: appUser.id,
    replaced_user_id: mode === "replacing" ? replacingUserId : null,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: insertError.message };
  }

  if (mode === "replacing" && replacingUserId) {
    const today = new Date().toISOString().slice(0, 10);

    const { data: toReassign, error: fetchError } = await supabase
      .from("task_instances")
      .select("id, assignee_id")
      .eq("assignee_id", replacingUserId)
      .eq("removed", false)
      .neq("status", "completed")
      .gte("due_date", today);
    if (fetchError) return { error: fetchError.message };

    for (const instance of toReassign ?? []) {
      const { error: updateError } = await supabase
        .from("task_instances")
        .update({ assignee_id: created.user.id })
        .eq("id", instance.id);
      if (updateError) return { error: updateError.message };

      await supabase.from("task_transfer_log").insert({
        task_instance_id: instance.id,
        from_user_id: instance.assignee_id,
        to_user_id: created.user.id,
        transferred_by: appUser.id,
        reason: "User replacement",
      });
    }

    await supabase.from("user_replacement_log").insert({
      old_user_id: replacingUserId,
      new_user_id: created.user.id,
      replaced_by: appUser.id,
    });
  }

  revalidatePath("/users");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null };
}

export async function createProject(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Project name is required." };

  const supabase = ctx.client ?? (await createClient());
  const { error } = await supabase.from("projects").insert({ org_id: orgId, name });
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null };
}

export async function createDesignation(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Designation name is required." };

  const supabase = ctx.client ?? (await createClient());
  const { error } = await supabase.from("designations").insert({ org_id: orgId, name });
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null };
}

export async function updateUser(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "reporting_manager", "platform_owner"]);

  const targetId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "") || null;
  const designationId = String(formData.get("designationId") ?? "") || null;
  const isActive = formData.get("isActive") === "on";
  const roleInput = formData.get("role");
  const reportsToInput = formData.get("reportsTo");

  if (!targetId || !fullName || !employeeCode) {
    return { error: "Name and employee code are required." };
  }

  // platform_owner has no org_id of their own, so app_users_update's RLS
  // check (current_org_id() = org_id) never passes for them -- they need
  // the service-role client, same as the other tenant-management actions.
  const supabase =
    appUser.system_role === "platform_owner" ? createAdminClient() : await createClient();

  if (appUser.system_role === "reporting_manager") {
    const readClient = await createClient();
    const { data: chain } = await readClient.rpc("reporting_chain", {
      p_manager_id: appUser.id,
    });
    if (!(chain ?? []).some((m) => m.id === targetId)) {
      return { error: "You can only edit people in your reporting chain." };
    }
  }

  const update: {
    full_name: string;
    employee_code: string;
    project_id: string | null;
    designation_id: string | null;
    is_active: boolean;
    system_role?: AppUser["system_role"];
    reports_to?: string | null;
  } = {
    full_name: fullName,
    employee_code: employeeCode,
    project_id: projectId,
    designation_id: designationId,
    is_active: isActive,
  };

  // Role and reporting-line changes are master_admin/platform_owner-only --
  // a reporting manager can update their reportees' basic fields but not
  // re-scope them.
  if (appUser.system_role === "master_admin" || appUser.system_role === "platform_owner") {
    if (roleInput) {
      const role = String(roleInput) as AppUser["system_role"];
      if (!CREATABLE_ROLES[appUser.system_role].includes(role)) {
        return { error: "You are not allowed to assign that role." };
      }
      update.system_role = role;
    }
    if (reportsToInput !== null) {
      update.reports_to = String(reportsToInput) || null;
    }
  }

  const { error } = await supabase.from("app_users").update(update).eq("id", targetId);
  if (error) return { error: error.message };

  const orgId = String(formData.get("orgId") ?? "");
  revalidatePath("/users");
  if (orgId) revalidatePath(`/tenants/${orgId}`);
  return { error: null };
}
