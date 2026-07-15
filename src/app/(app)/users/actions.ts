"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type AppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserFormState = { error: string | null };

const CREATABLE_ROLES: Record<AppUser["system_role"], AppUser["system_role"][]> = {
  master_admin: ["master_admin", "reporting_manager", "user"],
  reporting_manager: ["user"],
  platform_owner: [],
  user: [],
};

export async function createOrReplaceUser(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  if (!appUser.org_id) return { error: "No organization on this account." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "user") as AppUser["system_role"];
  const mode = String(formData.get("mode") ?? "new_hire"); // "new_hire" | "replacing"
  const replacingUserId = String(formData.get("replacingUserId") ?? "");
  const reportsToInput = String(formData.get("reportsTo") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Name, email, and a default password are required." };
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

  const reportsTo =
    appUser.system_role === "reporting_manager" ? appUser.id : reportsToInput || null;

  const admin = createAdminClient();
  const supabase = await createClient();

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
    org_id: appUser.org_id,
    system_role: role,
    full_name: fullName,
    email,
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
  return { error: null };
}
