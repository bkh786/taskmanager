"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverAnnouncement } from "@/lib/notify";
import { AUDIENCE_ROLES, type Audience, type NotifLevel, type RuleKind } from "@/lib/notification-shared";
import type { Json } from "@/types/database.types";

export type CenterState = { error: string | null; ok?: boolean };

const KINDS: RuleKind[] = ["task_completed", "task_assigned", "task_overdue"];
const lvl = (v: FormDataEntryValue | null): NotifLevel => (v === "critical" ? "critical" : "info");

// ------------------------------------------------------------------ automatic rules (org admins)
export async function saveRule(_prev: CenterState, formData: FormData): Promise<CenterState> {
  const appUser = await requireRole(["master_admin"]);
  if (!appUser.org_id) return { error: "No organization on this account." };
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "") as RuleKind;
  if (!KINDS.includes(kind)) return { error: "Unknown alert type." };

  const afterDays = kind === "task_overdue" ? Math.min(365, Math.max(0, Number(formData.get("afterDays") ?? 0) | 0)) : 0;
  const to_assignee = formData.get("toAssignee") === "on";
  const to_creator = formData.get("toCreator") === "on";
  const to_l1 = formData.get("toL1") === "on";
  const to_l2 = formData.get("toL2") === "on";
  const to_admins = formData.get("toAdmins") === "on";
  if (!to_assignee && !to_creator && !to_l1 && !to_l2 && !to_admins) {
    return { error: "Choose at least one person to notify." };
  }
  const row = {
    name: String(formData.get("name") ?? "").trim().slice(0, 80),
    enabled: formData.get("enabled") === "on",
    level: lvl(formData.get("level")),
    after_days: afterDays,
    to_assignee,
    to_creator,
    to_l1,
    to_l2,
    to_admins,
    send_push: formData.get("sendPush") === "on",
  };
  const admin = createAdminClient();
  if (id) {
    const { error } = await admin.from("notification_rules").update(row).eq("id", id).eq("org_id", appUser.org_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("notification_rules").insert({ ...row, org_id: appUser.org_id, kind });
    if (error) return { error: error.message };
  }
  revalidatePath("/notification-center");
  return { error: null, ok: true };
}

export async function addRule(kind: RuleKind): Promise<CenterState> {
  const appUser = await requireRole(["master_admin"]);
  if (!appUser.org_id || !KINDS.includes(kind)) return { error: "Not allowed." };
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("notification_rules")
    .select("after_days")
    .eq("org_id", appUser.org_id)
    .eq("kind", kind)
    .order("after_days", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin.from("notification_rules").insert({
    org_id: appUser.org_id,
    kind,
    name: kind === "task_overdue" ? "New escalation step" : kind === "task_completed" ? "Task completed" : "Task assigned",
    level: kind === "task_overdue" ? "critical" : "info",
    after_days: kind === "task_overdue" ? Math.min(365, (last?.after_days ?? 0) + 2) : 0,
    to_assignee: kind !== "task_completed",
    to_creator: kind === "task_completed",
  });
  if (error) return { error: error.message };
  revalidatePath("/notification-center");
  return { error: null };
}

export async function deleteRule(id: string): Promise<CenterState> {
  const appUser = await requireRole(["master_admin"]);
  if (!appUser.org_id) return { error: "Not allowed." };
  const { error } = await createAdminClient().from("notification_rules").delete().eq("id", id).eq("org_id", appUser.org_id);
  if (error) return { error: error.message };
  revalidatePath("/notification-center");
  return { error: null };
}

// ------------------------------------------------------------------ announcements
function parseAudience(formData: FormData, isPlatform: boolean): Audience | string {
  if (isPlatform) {
    const all = formData.get("allOrgs") === "on";
    const orgIds = formData.getAll("orgIds").map(String).filter(Boolean);
    if (!all && orgIds.length === 0) return "Choose all organizations or pick at least one.";
    return { scope: "orgs", org_ids: all ? null : orgIds, admins_only: formData.get("adminsOnly") === "on" };
  }
  const scope = String(formData.get("scope") ?? "all");
  if (scope === "roles") {
    const roles = formData.getAll("roles").map(String).filter((r) => AUDIENCE_ROLES.some((x) => x.value === r));
    if (roles.length === 0) return "Pick at least one role.";
    return { scope: "roles", roles };
  }
  if (scope === "projects") {
    const ids = formData.getAll("projectIds").map(String).filter(Boolean);
    if (ids.length === 0) return "Pick at least one project.";
    return { scope: "projects", project_ids: ids };
  }
  if (scope === "users") {
    const ids = formData.getAll("userIds").map(String).filter(Boolean);
    if (ids.length === 0) return "Pick at least one person.";
    return { scope: "users", user_ids: ids };
  }
  return { scope: "all" };
}

export async function createAnnouncement(_prev: CenterState, formData: FormData): Promise<CenterState> {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const isPlatform = appUser.system_role === "platform_owner";
  if (!isPlatform && !appUser.org_id) return { error: "No organization on this account." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  let link = String(formData.get("link") ?? "").trim();
  if (!title) return { error: "A title is required." };
  if (title.length > 200) return { error: "The title is too long." };
  if (body.length > 2000) return { error: "The message is too long (2,000 characters)." };
  // Links stay inside the app (a path) or point at an https page.
  if (link && !(link.startsWith("/") && !link.startsWith("//")) && !/^https:\/\//i.test(link)) {
    return { error: "The link must start with / (a page in the app) or https://." };
  }
  if (!link) link = "";

  const audience = parseAudience(formData, isPlatform);
  if (typeof audience === "string") return { error: audience };

  let publishAt: string | null = null;
  if (formData.get("when") === "later") {
    const raw = String(formData.get("publishAt") ?? "");
    // The picker has no time zone; times are India Standard Time.
    const t = raw ? new Date(`${raw}:00+05:30`) : null;
    if (!t || Number.isNaN(t.getTime())) return { error: "Pick a date and time to send." };
    if (t.getTime() < Date.now() + 60_000) return { error: "Pick a time in the future, or choose Send now." };
    publishAt = t.toISOString();
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("announcements")
    .insert({
      org_id: isPlatform ? null : appUser.org_id,
      created_by: appUser.id,
      level: lvl(formData.get("level")),
      title,
      body: body || null,
      link: link || null,
      audience: audience as unknown as Json,
      send_push: formData.get("sendPush") === "on",
      publish_at: publishAt ?? new Date().toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Could not create the announcement." };

  if (!publishAt) {
    const r = await deliverAnnouncement(created.id);
    if (r.error) return { error: r.error };
  }
  revalidatePath("/notification-center");
  return { error: null, ok: true };
}

async function ownAnnouncement(id: string) {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const admin = createAdminClient();
  const { data } = await admin.from("announcements").select("id, org_id, status").eq("id", id).maybeSingle();
  const mine = data && (appUser.system_role === "platform_owner" ? data.org_id === null : data.org_id === appUser.org_id);
  if (!data || !mine) return { error: "Announcement not found.", admin: null, row: null };
  return { error: null, admin, row: data };
}

export async function cancelAnnouncement(id: string): Promise<CenterState> {
  const r = await ownAnnouncement(id);
  if (r.error || !r.admin) return { error: r.error ?? "Not allowed." };
  if (r.row.status !== "scheduled") return { error: "Only scheduled announcements can be cancelled." };
  const { error } = await r.admin.from("announcements").update({ status: "cancelled" }).eq("id", id).eq("status", "scheduled");
  if (error) return { error: error.message };
  revalidatePath("/notification-center");
  return { error: null };
}

/** Removes a sent announcement from everyone's inbox. */
export async function withdrawAnnouncement(id: string): Promise<CenterState> {
  const r = await ownAnnouncement(id);
  if (r.error || !r.admin) return { error: r.error ?? "Not allowed." };
  if (r.row.status !== "sent") return { error: "Only sent announcements can be withdrawn." };
  const { error } = await r.admin.from("notifications").delete().eq("ref_id", id);
  if (error) return { error: error.message };
  await r.admin.from("announcements").update({ status: "withdrawn" }).eq("id", id);
  revalidatePath("/notification-center");
  return { error: null };
}
