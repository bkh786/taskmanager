import "server-only";
import { randomUUID } from "node:crypto";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl } from "@/lib/email";
import { fmtDate } from "@/lib/task-status";
import type { Audience, NotifLevel } from "@/lib/notification-shared";
import type { Json, Tables } from "@/types/database.types";

type Admin = ReturnType<typeof createAdminClient>;
type Rule = Tables<"notification_rules">;

export type NewNotification = {
  org_id: string | null;
  user_id: string;
  level: NotifLevel;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  source: "rule" | "announcement" | "platform" | "system";
  ref_id?: string | null;
  dedupe_key?: string;
};

type Created = { id: string; user_id: string; level: NotifLevel; kind: string; title: string; body: string | null; link: string | null };

// ------------------------------------------------------------------ push
let pushReady: boolean | null = null;
function configurePush(): boolean {
  if (pushReady !== null) return pushReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return (pushReady = false);
  setVapidDetails(subject, pub, priv);
  return (pushReady = true);
}

export function pushConfigured(): boolean {
  return configurePush();
}

/** Sends a Web Push to every registered device of the recipients (respecting their preferences). Never throws. */
export async function sendPush(rows: Created[]): Promise<{ sent: number; failed: number }> {
  if (rows.length === 0 || !configurePush()) return { sent: 0, failed: 0 };
  const admin = createAdminClient();
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const subs: Tables<"push_subscriptions">[] = [];
  const prefs = new Map<string, { push_info: boolean; push_critical: boolean }>();
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    const [{ data: s }, { data: p }] = await Promise.all([
      admin.from("push_subscriptions").select("*").in("user_id", chunk),
      admin.from("notification_prefs").select("*").in("user_id", chunk),
    ]);
    subs.push(...(s ?? []));
    for (const x of p ?? []) prefs.set(x.user_id, x);
  }
  const byUser = new Map<string, Tables<"push_subscriptions">[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const jobs: { sub: Tables<"push_subscriptions">; row: Created }[] = [];
  for (const row of rows) {
    const p = prefs.get(row.user_id);
    if (p && (row.level === "critical" ? !p.push_critical : !p.push_info)) continue;
    for (const sub of byUser.get(row.user_id) ?? []) jobs.push({ sub, row });
  }

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  for (let i = 0; i < jobs.length; i += 10) {
    await Promise.all(
      jobs.slice(i, i + 10).map(async ({ sub, row }) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              id: row.id,
              title: row.title,
              body: row.body ?? "",
              url: row.link || "/notifications",
              level: row.level,
              tag: `${row.kind}-${row.id}`,
            }),
            { TTL: 24 * 3600, urgency: row.level === "critical" ? "high" : "normal" }
          );
          sent++;
        } catch (e) {
          failed++;
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(sub.endpoint);
        }
      })
    );
  }
  if (gone.length > 0) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  return { sent, failed };
}

// ------------------------------------------------------------------ creating notifications
/** Stores notifications (once per person per event) and pushes the new ones. Never throws. */
export async function createNotifications(
  rows: NewNotification[],
  opts: { push: boolean } = { push: true }
): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    const admin = createAdminClient();
    const created: Created[] = [];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({
        org_id: r.org_id,
        user_id: r.user_id,
        level: r.level,
        kind: r.kind,
        title: r.title.slice(0, 200),
        body: r.body ?? null,
        link: r.link ?? null,
        source: r.source,
        ref_id: r.ref_id ?? null,
        dedupe_key: r.dedupe_key ?? randomUUID(),
      }));
      const { data, error } = await admin
        .from("notifications")
        .upsert(chunk, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select("id, user_id, level, kind, title, body, link");
      if (error) throw error;
      created.push(...((data ?? []) as Created[]));
    }
    if (opts.push) await sendPush(created);
    return created.length;
  } catch (e) {
    console.error("createNotifications failed:", e);
    return 0;
  }
}

// ------------------------------------------------------------------ who is who in an organization
type Person = {
  id: string;
  full_name: string;
  reports_to: string | null;
  system_role: string;
  is_active: boolean | null;
};

async function loadPeople(admin: Admin, orgId: string): Promise<Map<string, Person>> {
  const out = new Map<string, Person>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("app_users")
      .select("id, full_name, reports_to, system_role, is_active")
      .eq("org_id", orgId)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const p of data ?? []) out.set(p.id, p);
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

function recipientsFor(
  rule: Pick<Rule, "to_assignee" | "to_creator" | "to_l1" | "to_l2" | "to_admins">,
  people: Map<string, Person>,
  ctx: { assigneeId: string | null; creatorId: string | null; exclude?: string | null }
): string[] {
  const ids = new Set<string>();
  const l1 = ctx.assigneeId ? (people.get(ctx.assigneeId)?.reports_to ?? null) : null;
  const l2 = l1 ? (people.get(l1)?.reports_to ?? null) : null;
  if (rule.to_assignee && ctx.assigneeId) ids.add(ctx.assigneeId);
  if (rule.to_creator && ctx.creatorId) ids.add(ctx.creatorId);
  if (rule.to_l1 && l1) ids.add(l1);
  if (rule.to_l2 && l2) ids.add(l2);
  if (rule.to_admins) for (const p of people.values()) if (p.system_role === "master_admin") ids.add(p.id);
  return [...ids].filter((id) => id !== ctx.exclude && people.get(id)?.is_active !== false && people.has(id));
}

async function rulesFor(admin: Admin, orgId: string, kind: string): Promise<Rule[]> {
  const { data } = await admin
    .from("notification_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", kind)
    .eq("enabled", true)
    .order("after_days");
  return data ?? [];
}

// ------------------------------------------------------------------ event hooks
export async function notifyTaskCompleted(opts: { orgId: string; instanceId: string; completedBy: string }) {
  try {
    const admin = createAdminClient();
    const rules = await rulesFor(admin, opts.orgId, "task_completed");
    if (rules.length === 0) return;
    const { data: inst } = await admin
      .from("task_instances")
      .select(
        `id, due_date, assignee_id,
         task:tasks!task_instances_task_id_fkey(task_name, created_by, notify_on_complete)`
      )
      .eq("id", opts.instanceId)
      .maybeSingle();
    const task = inst?.task as { task_name: string; created_by: string | null; notify_on_complete: boolean | null } | null;
    if (!inst || !task) return;
    const people = await loadPeople(admin, opts.orgId);
    const who = people.get(opts.completedBy)?.full_name ?? "A teammate";
    for (const rule of rules) {
      const to = recipientsFor(
        // A task can opt out of telling its creator.
        { ...rule, to_creator: rule.to_creator && task.notify_on_complete !== false },
        people,
        { assigneeId: inst.assignee_id, creatorId: task.created_by, exclude: opts.completedBy }
      );
      await createNotifications(
        to.map((user_id) => ({
          org_id: opts.orgId,
          user_id,
          level: rule.level as NotifLevel,
          kind: "task_completed",
          title: `Completed: ${task.task_name}`,
          body: `${who} marked this task as completed.`,
          link: `/tasks/${inst.id}`,
          source: "rule" as const,
          ref_id: inst.id,
          dedupe_key: `completed:${inst.id}:${rule.id}`,
        })),
        { push: rule.send_push }
      );
    }
  } catch (e) {
    console.error("notifyTaskCompleted failed:", e);
  }
}

export async function notifyTaskAssigned(opts: {
  orgId: string;
  instanceId: string | null;
  taskId: string;
  taskName: string;
  assigneeId: string;
  assignerId: string;
}) {
  try {
    if (opts.assigneeId === opts.assignerId) return;
    const admin = createAdminClient();
    const rules = await rulesFor(admin, opts.orgId, "task_assigned");
    if (rules.length === 0) return;
    const people = await loadPeople(admin, opts.orgId);
    const by = people.get(opts.assignerId)?.full_name ?? "Someone";
    for (const rule of rules) {
      const to = recipientsFor(rule, people, { assigneeId: opts.assigneeId, creatorId: opts.assignerId, exclude: opts.assignerId });
      await createNotifications(
        to.map((user_id) => ({
          org_id: opts.orgId,
          user_id,
          level: rule.level as NotifLevel,
          kind: "task_assigned",
          title: `New task: ${opts.taskName}`,
          body: `${by} assigned you a task.`,
          link: opts.instanceId ? `/tasks/${opts.instanceId}` : "/dashboard",
          source: "rule" as const,
          ref_id: opts.instanceId,
          dedupe_key: `assigned:${opts.taskId}:${rule.id}`,
        })),
        { push: rule.send_push }
      );
    }
  } catch (e) {
    console.error("notifyTaskAssigned failed:", e);
  }
}

// ------------------------------------------------------------------ overdue escalation (cron)
function todayIn(tz: string): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function runOverdueForOrg(admin: Admin, org: { id: string; timezone: string }) {
  const rules = await rulesFor(admin, org.id, "task_overdue");
  if (rules.length === 0) return 0;
  const today = todayIn(org.timezone);
  const people = await loadPeople(admin, org.id);
  let total = 0;
  for (const rule of rules) {
    // A step fires on its day, with one day of grace in case a job run was missed.
    const newest = addDays(today, -rule.after_days);
    const oldest = addDays(today, -rule.after_days - 1);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("task_instances")
        .select(
          `id, due_date, assignee_id,
           task:tasks!task_instances_task_id_fkey!inner(task_name, org_id, created_by)`
        )
        .eq("task.org_id", org.id)
        .eq("removed", false)
        .neq("status", "completed")
        .gte("due_date", oldest)
        .lte("due_date", newest)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      const batch: NewNotification[] = [];
      for (const inst of data ?? []) {
        const task = inst.task as unknown as { task_name: string; created_by: string | null } | null;
        if (!task || !inst.assignee_id) continue;
        const days = Math.round((Date.parse(today) - Date.parse(inst.due_date)) / 86400000);
        const assignee = people.get(inst.assignee_id);
        const to = recipientsFor(rule, people, { assigneeId: inst.assignee_id, creatorId: task.created_by });
        for (const user_id of to) {
          const mine = user_id === inst.assignee_id;
          batch.push({
            org_id: org.id,
            user_id,
            level: rule.level as NotifLevel,
            kind: "task_overdue",
            title: `Overdue: ${task.task_name}`,
            body: mine
              ? `This task was due ${fmtDate(inst.due_date)} and is ${days} day${days === 1 ? "" : "s"} overdue.`
              : `${assignee?.full_name ?? "A teammate"}'s task was due ${fmtDate(inst.due_date)} and is ${days} day${days === 1 ? "" : "s"} overdue.`,
            link: `/tasks/${inst.id}`,
            source: "rule",
            ref_id: inst.id,
            dedupe_key: `overdue:${rule.id}:${inst.id}`,
          });
        }
      }
      total += await createNotifications(batch, { push: rule.send_push });
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  return total;
}

// ------------------------------------------------------------------ announcements
export async function deliverAnnouncement(id: string): Promise<{ count: number; error?: string }> {
  const admin = createAdminClient();
  const { data: a } = await admin.from("announcements").select("*").eq("id", id).maybeSingle();
  if (!a) return { count: 0, error: "Announcement not found." };
  if (a.status !== "scheduled" && a.status !== "sent") return { count: 0, error: "This announcement was cancelled." };
  // Claim it so two runs can't both send it.
  const { data: claimed } = await admin
    .from("announcements")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id");
  const wasPending = (claimed?.length ?? 0) > 0;
  if (!wasPending && a.status === "sent" && a.recipient_count > 0) return { count: a.recipient_count };

  const audience = a.audience as unknown as Audience;
  const recipients = new Map<string, string | null>(); // user id -> org id

  const addOrg = async (orgId: string, filter: (p: Person) => boolean) => {
    const people = await loadPeople(admin, orgId);
    for (const p of people.values()) if (p.is_active !== false && p.system_role !== "platform_owner" && filter(p)) recipients.set(p.id, orgId);
  };

  if (a.org_id) {
    if (audience.scope === "roles") {
      const roles = new Set(audience.roles);
      await addOrg(a.org_id, (p) => roles.has(p.system_role));
    } else if (audience.scope === "users") {
      const ids = new Set(audience.user_ids);
      await addOrg(a.org_id, (p) => ids.has(p.id));
    } else if (audience.scope === "projects") {
      const members = new Set<string>();
      for (let i = 0; i < audience.project_ids.length; i += 50) {
        const slice = audience.project_ids.slice(i, i + 50);
        for (let from = 0; ; from += 1000) {
          const { data } = await admin.from("user_projects").select("user_id").in("project_id", slice).order("user_id").range(from, from + 999);
          for (const r of data ?? []) members.add(r.user_id);
          if ((data?.length ?? 0) < 1000) break;
        }
        const { data: primary } = await admin.from("app_users").select("id").eq("org_id", a.org_id).in("project_id", slice);
        for (const r of primary ?? []) members.add(r.id);
      }
      await addOrg(a.org_id, (p) => members.has(p.id));
    } else {
      await addOrg(a.org_id, () => true);
    }
  } else {
    const wanted = audience.scope === "orgs" ? audience.org_ids : null;
    const adminsOnly = audience.scope === "orgs" ? audience.admins_only : false;
    let q = admin.from("organizations").select("id").eq("is_active", true);
    if (wanted && wanted.length > 0) q = q.in("id", wanted);
    const { data: orgs } = await q;
    for (const o of orgs ?? []) await addOrg(o.id, (p) => (adminsOnly ? p.system_role === "master_admin" : true));
  }

  const count = await createNotifications(
    [...recipients].map(([user_id, org_id]) => ({
      org_id,
      user_id,
      level: a.level as NotifLevel,
      kind: a.org_id ? "announcement" : "platform_update",
      title: a.title,
      body: a.body,
      link: a.link,
      source: a.org_id ? ("announcement" as const) : ("platform" as const),
      ref_id: a.id,
      dedupe_key: `ann:${a.id}`,
    })),
    { push: a.send_push }
  );
  await admin.from("announcements").update({ recipient_count: count, status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
  return { count };
}

export async function runAlerts(opts: { orgId?: string } = {}): Promise<{ overdue: number; announcements: number; errors: string[] }> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let overdue = 0;
  let orgQuery = admin.from("organizations").select("id, timezone").eq("is_active", true);
  if (opts.orgId) orgQuery = orgQuery.eq("id", opts.orgId);
  const { data: orgs } = await orgQuery;
  for (const org of orgs ?? []) {
    try {
      overdue += await runOverdueForOrg(admin, org);
    } catch (e) {
      errors.push(`${org.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  let announcements = 0;
  let dueQuery = admin
    .from("announcements")
    .select("id")
    .eq("status", "scheduled")
    .lte("publish_at", new Date().toISOString());
  if (opts.orgId) dueQuery = dueQuery.eq("org_id", opts.orgId);
  const { data: due } = await dueQuery;
  for (const a of due ?? []) {
    const r = await deliverAnnouncement(a.id);
    if (r.error) errors.push(`announcement ${a.id}: ${r.error}`);
    else announcements++;
  }
  return { overdue, announcements, errors };
}

/** Link helper for emails and pushes. */
export function absoluteLink(path: string): string {
  return `${appBaseUrl()}${path}`;
}

export type { Json };

/** Starting rules for a new organization (the same ones the migration gives existing ones). */
export async function ensureDefaultRules(orgId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { count } = await admin.from("notification_rules").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    if ((count ?? 0) > 0) return;
    const base = { org_id: orgId, send_push: true, enabled: true } as const;
    await admin.from("notification_rules").insert([
      { ...base, kind: "task_completed", name: "Task completed", level: "info", after_days: 0, to_assignee: false, to_creator: true, to_l1: false, to_l2: false, to_admins: false },
      { ...base, kind: "task_assigned", name: "Task assigned", level: "info", after_days: 0, to_assignee: true, to_creator: false, to_l1: false, to_l2: false, to_admins: false },
      { ...base, kind: "task_overdue", name: "Overdue — first reminder", level: "critical", after_days: 1, to_assignee: true, to_creator: false, to_l1: false, to_l2: false, to_admins: false },
      { ...base, kind: "task_overdue", name: "Overdue — escalate to manager", level: "critical", after_days: 3, to_assignee: true, to_creator: false, to_l1: true, to_l2: false, to_admins: false },
      { ...base, kind: "task_overdue", name: "Overdue — escalate further", level: "critical", after_days: 7, to_assignee: true, to_creator: false, to_l1: true, to_l2: true, to_admins: true },
    ]);
  } catch (e) {
    console.error("ensureDefaultRules failed:", e);
  }
}
