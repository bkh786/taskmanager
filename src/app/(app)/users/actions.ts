"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole, type AppUser } from "@/lib/auth";
import { sendOrgEvent } from "@/lib/email";
import { ROLE_LABEL } from "@/lib/email-events";
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
  const projectId = String(formData.get("projectId") ?? "") || null;
  const designationId = String(formData.get("designationId") ?? "") || null;

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

  // The chosen project and designation must belong to this organization.
  if (projectId) {
    const { data } = await admin.from("projects").select("id").eq("id", projectId).eq("org_id", orgId).maybeSingle();
    if (!data) return { error: "That project doesn't belong to this organization." };
  }
  if (designationId) {
    const { data } = await admin.from("designations").select("id").eq("id", designationId).eq("org_id", orgId).maybeSingle();
    if (!data) return { error: "That designation doesn't belong to this organization." };
  }

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
    project_id: projectId,
    designation_id: designationId,
    created_by: appUser.id,
    replaced_user_id: mode === "replacing" ? replacingUserId : null,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: insertError.message };
  }

  // Welcome email (respects the org's on/off switch and template) -- sent in
  // the background so the form returns immediately.
  after(() =>
    sendOrgEvent({
      orgId,
      event: "user_created",
      to: email,
      vars: {
        user_name: fullName,
        user_email: email,
        employee_code: employeeCode,
        role: ROLE_LABEL[role] ?? role,
      },
    })
  );

  if (mode === "replacing" && replacingUserId) {
    const today = new Date().toISOString().slice(0, 10);

    // Everything the replaced person still has open moves to the new hire.
    // One bulk update plus one bulk log insert -- not a round trip per task --
    // reading the affected ids in pages first (the API caps a response at 1,000 rows).
    const toReassign: { id: string; assignee_id: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: fetchError } = await supabase
        .from("task_instances")
        .select("id, assignee_id")
        .eq("assignee_id", replacingUserId)
        .eq("removed", false)
        .neq("status", "completed")
        .gte("due_date", today)
        .order("id")
        .range(from, from + 999);
      if (fetchError) return { error: fetchError.message };
      toReassign.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }

    if (toReassign.length > 0) {
      const { error: updateError } = await supabase
        .from("task_instances")
        .update({ assignee_id: created.user.id })
        .eq("assignee_id", replacingUserId)
        .eq("removed", false)
        .neq("status", "completed")
        .gte("due_date", today);
      if (updateError) return { error: updateError.message };

      for (let i = 0; i < toReassign.length; i += 500) {
        const { error: logError } = await supabase.from("task_transfer_log").insert(
          toReassign.slice(i, i + 500).map((instance) => ({
            task_instance_id: instance.id,
            from_user_id: instance.assignee_id,
            to_user_id: created.user.id,
            transferred_by: appUser.id,
            reason: "User replacement",
          }))
        );
        if (logError) return { error: logError.message };
      }
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
  revalidatePath("/org-settings");
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
  const parent = parseParent(String(formData.get("parent") ?? ""));
  if (!name) return { error: "Designation name is required." };

  const supabase = ctx.client ?? (await createClient());
  const { error } = await supabase.from("designations").insert({
    org_id: orgId,
    name,
    ...(parent.designationId ? { reports_to_designation_id: parent.designationId } : {}),
    ...(parent.role ? { reports_to_role: parent.role } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath("/org-settings");
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
    mobile_number?: string | null;
    email?: string;
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
      const newManager = String(reportsToInput) || null;
      if (newManager && (await createsReportingLoop(supabase, targetId, newManager))) {
        return { error: "That would make someone report to themselves (a loop in the hierarchy)." };
      }
      update.reports_to = newManager;
    }
  }

  // Org admins and the platform owner may also change the sign-in email and
  // mobile number. The email lives in Auth as well, so both are updated.
  let newEmail: string | null = null;
  if (appUser.system_role === "master_admin" || appUser.system_role === "platform_owner") {
    const mobile = formData.get("mobileNumber");
    if (mobile !== null) update.mobile_number = String(mobile).trim() || null;
    const emailInput = formData.get("email");
    if (emailInput !== null) {
      const email = String(emailInput).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
      const { data: current } = await supabase.from("app_users").select("email, org_id").eq("id", targetId).single();
      if (!current) return { error: "User not found." };
      if (appUser.system_role === "master_admin" && current.org_id !== appUser.org_id) {
        return { error: "That user is not in your organization." };
      }
      if (email !== current.email.toLowerCase()) {
        const { data: clash } = await supabase.from("app_users").select("id").ilike("email", email).neq("id", targetId).maybeSingle();
        if (clash) return { error: "Another user already has that email." };
        newEmail = email;
        update.email = email;
      }
    }
  }

  if (newEmail) {
    const { error: authError } = await createAdminClient().auth.admin.updateUserById(targetId, {
      email: newEmail,
      email_confirm: true,
    });
    if (authError) return { error: authError.message };
  }

  const { error } = await supabase.from("app_users").update(update).eq("id", targetId);
  if (error) return { error: error.message };

  const orgId = String(formData.get("orgId") ?? "");
  revalidatePath("/users");
  if (orgId) revalidatePath(`/tenants/${orgId}`);
  return { error: null };
}

async function renameOrgItem(
  table: "projects" | "designations",
  label: string,
  formData: FormData
): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: `${label} not found.` };
  if (!name) return { error: `${label} name is required.` };

  const supabase = ctx.client ?? (await createClient());
  const { error } = await supabase.from(table).update({ name }).eq("id", id).eq("org_id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/users");
  revalidatePath("/org-settings");
  revalidatePath(`/tenants/${orgId}`);
  return { error: null };
}

export async function renameProject(formData: FormData): Promise<UserFormState> {
  return renameOrgItem("projects", "Project", formData);
}

export async function renameDesignation(formData: FormData): Promise<UserFormState> {
  return renameOrgItem("designations", "Designation", formData);
}

/** "d:<designation id>" | "r:<system role>" | "" -> what a designation reports to. */
function parseParent(raw: string): { designationId: string | null; role: string | null } {
  if (raw.startsWith("d:")) return { designationId: raw.slice(2) || null, role: null };
  if (raw === "r:master_admin" || raw === "r:reporting_manager") {
    return { designationId: null, role: raw.slice(2) };
  }
  return { designationId: null, role: null };
}

/** Maps a designation to what its holders report to: another designation, a system role, or nothing (top of the hierarchy). */
export async function setDesignationParent(formData: FormData): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const id = String(formData.get("id") ?? "");
  const { designationId: parentId, role: parentRole } = parseParent(String(formData.get("parent") ?? ""));
  if (!id) return { error: "Designation not found." };

  const supabase = ctx.client ?? (await createClient());

  // No loops: walking up from the chosen parent must never reach this designation.
  let cursor = parentId;
  for (let i = 0; cursor && i < 50; i++) {
    if (cursor === id) return { error: "That would create a loop in the hierarchy." };
    const { data } = await supabase
      .from("designations")
      .select("reports_to_designation_id")
      .eq("id", cursor)
      .maybeSingle();
    cursor = data?.reports_to_designation_id ?? null;
  }

  const { error } = await supabase
    .from("designations")
    .update({ reports_to_designation_id: parentId, reports_to_role: parentRole })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) {
    return {
      error: /column|schema cache/i.test(error.message)
        ? "Apply the latest database migrations (designation hierarchy) first."
        : error.message,
    };
  }

  revalidatePath("/org-settings");
  revalidatePath("/users");
  return { error: null };
}

/** True if making `managerId` the manager of `userId` would put someone above themselves. */
async function createsReportingLoop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  managerId: string
): Promise<boolean> {
  let cursor: string | null = managerId;
  for (let i = 0; cursor && i < 100; i++) {
    if (cursor === userId) return true;
    const res: { data: { reports_to: string | null } | null } = await supabase
      .from("app_users")
      .select("reports_to")
      .eq("id", cursor)
      .maybeSingle();
    cursor = res.data?.reports_to ?? null;
  }
  return false;
}
