"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { requireRole, type AppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgContext } from "@/lib/org-context";

export type BulkUserUploadState = {
  error: string | null;
  created: number;
  skipped: { row: number; reason: string }[];
};

const CREATABLE_ROLES: Record<AppUser["system_role"], AppUser["system_role"][]> = {
  master_admin: ["master_admin", "reporting_manager", "user"],
  platform_owner: ["master_admin", "reporting_manager", "user"],
  reporting_manager: [],
  user: [],
};

type Row = {
  org_code?: unknown;
  full_name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  project?: unknown;
  designation?: unknown;
  reports_to_email?: unknown;
};

export async function bulkCreateUsers(
  _prev: BulkUserUploadState,
  formData: FormData
): Promise<BulkUserUploadState> {
  const initial: BulkUserUploadState = { error: null, created: 0, skipped: [] };
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const ctx = resolveOrgContext(appUser, formData);
  if ("error" in ctx) return { ...initial, error: ctx.error };
  const { orgId } = ctx;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...initial, error: "Choose an .xlsx file to upload." };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  if (rows.length === 0) {
    return { ...initial, error: "The file has no data rows." };
  }

  const admin = createAdminClient();
  const readClient = ctx.client ?? (await createClient());

  const { data: org } = await admin.from("organizations").select("slug").eq("id", orgId).single();
  if (!org) return { ...initial, error: "Could not resolve the target organization." };

  const [{ data: existingUsers }, { data: projects }, { data: designations }] = await Promise.all([
    admin.from("app_users").select("id, email").eq("org_id", orgId),
    admin.from("projects").select("id, name").eq("org_id", orgId),
    admin.from("designations").select("id, name").eq("org_id", orgId),
  ]);
  const emailToId = new Map((existingUsers ?? []).map((u) => [u.email.toLowerCase(), u.id]));
  const projectByName = new Map(
    (projects ?? []).map((p) => [p.name.trim().toLowerCase(), p.id])
  );
  const designationByName = new Map(
    (designations ?? []).map((d) => [d.name.trim().toLowerCase(), d.id])
  );

  const skipped: BulkUserUploadState["skipped"] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // account for header row, 1-indexed
    const row = rows[i];

    const orgCode = String(row.org_code ?? "").trim();
    if (orgCode !== org.slug) {
      skipped.push({
        row: rowNum,
        reason: `org_code "${orgCode}" does not match this organization's code "${org.slug}".`,
      });
      continue;
    }

    const fullName = String(row.full_name ?? "").trim();
    const email = String(row.email ?? "").trim().toLowerCase();
    const password = String(row.password ?? "");
    if (!fullName || !email || !password) {
      skipped.push({ row: rowNum, reason: "Missing full_name, email, or password." });
      continue;
    }
    if (password.length < 8) {
      skipped.push({ row: rowNum, reason: "password must be at least 8 characters." });
      continue;
    }
    if (emailToId.has(email)) {
      skipped.push({ row: rowNum, reason: `A user with email ${email} already exists.` });
      continue;
    }

    const roleRaw = String(row.role ?? "user").trim().toLowerCase() as AppUser["system_role"];
    if (!CREATABLE_ROLES[appUser.system_role].includes(roleRaw)) {
      skipped.push({ row: rowNum, reason: `Invalid or disallowed role "${roleRaw}".` });
      continue;
    }

    const projectRaw = String(row.project ?? "").trim();
    const projectId = projectRaw ? projectByName.get(projectRaw.toLowerCase()) : undefined;
    if (projectRaw && !projectId) {
      skipped.push({
        row: rowNum,
        reason: `Unknown project "${projectRaw}" — create it in User Management first.`,
      });
      continue;
    }

    const designationRaw = String(row.designation ?? "").trim();
    const designationId = designationRaw
      ? designationByName.get(designationRaw.toLowerCase())
      : undefined;
    if (designationRaw && !designationId) {
      skipped.push({
        row: rowNum,
        reason: `Unknown designation "${designationRaw}" — create it in User Management first.`,
      });
      continue;
    }

    const reportsToEmail = String(row.reports_to_email ?? "").trim().toLowerCase();
    const reportsToId = reportsToEmail ? emailToId.get(reportsToEmail) : undefined;
    if (reportsToEmail && !reportsToId) {
      skipped.push({
        row: rowNum,
        reason: `Unknown reports_to_email "${reportsToEmail}" — that user must already exist.`,
      });
      continue;
    }

    const { data: createdAuthUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !createdAuthUser.user) {
      skipped.push({
        row: rowNum,
        reason: `Could not create account: ${createError?.message ?? "unknown error"}.`,
      });
      continue;
    }

    const { error: insertError } = await readClient.from("app_users").insert({
      id: createdAuthUser.user.id,
      org_id: orgId,
      system_role: roleRaw,
      full_name: fullName,
      email,
      project_id: projectId ?? null,
      designation_id: designationId ?? null,
      reports_to: reportsToId ?? null,
      created_by: appUser.id,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(createdAuthUser.user.id);
      skipped.push({ row: rowNum, reason: `Could not save user record: ${insertError.message}.` });
      continue;
    }

    emailToId.set(email, createdAuthUser.user.id);
    created++;
  }

  if (created > 0) {
    revalidatePath("/users");
    revalidatePath(`/tenants/${orgId}`);
  }
  return { error: null, created, skipped };
}
