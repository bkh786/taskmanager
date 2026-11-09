import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl, sendOrgEvent } from "@/lib/email";
import { parseEmailList, type EmailEventId } from "@/lib/email-events";
import { fmtDate } from "@/lib/task-status";

const REMINDER_EVENTS: EmailEventId[] = ["reminder_upcoming", "reminder_delayed", "reminder_missed"];

/**
 * Relay used by the send-reminders Supabase Edge Function. The Edge Function
 * decides WHO gets reminded and WHEN (and the dedup); this route owns HOW:
 * the wording comes from the org's reminder templates, and the send goes out
 * through the org's SMTP (Node runtime -- the Edge Runtime can't open raw
 * SMTP connections).
 *
 * Authenticated by shared secret (CRON_SECRET), not a user session -- there
 * is no session in this call path. The recipient and task details are read
 * from the database, never taken from the request body.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { orgId, notifType, taskInstanceId } = body as {
    orgId?: string;
    notifType?: string;
    taskInstanceId?: string | null;
  };

  if (!orgId || !notifType || !taskInstanceId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!REMINDER_EVENTS.includes(notifType as EmailEventId)) {
    return NextResponse.json({ error: "unsupported notification type" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: inst } = await admin
    .from("task_instances")
    .select(
      `id, due_date,
       assignee:app_users!task_instances_assignee_id_fkey(email, full_name),
       task:tasks!task_instances_task_id_fkey(task_name, org_id, notification_cc)`
    )
    .eq("id", taskInstanceId)
    .maybeSingle();

  if (!inst || !inst.assignee || !inst.task || inst.task.org_id !== orgId) {
    return NextResponse.json({ error: "task instance not found" }, { status: 404 });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const daysOverdue = Math.max(
    0,
    Math.floor((Date.parse(todayIso) - Date.parse(inst.due_date)) / 86400000)
  );

  const result = await sendOrgEvent({
    orgId,
    event: notifType as EmailEventId,
    to: inst.assignee.email,
    taskInstanceId: inst.id,
    extraCc: parseEmailList(inst.task.notification_cc),
    vars: {
      assignee_name: inst.assignee.full_name,
      task_name: inst.task.task_name,
      due_date: fmtDate(inst.due_date),
      days_overdue: daysOverdue,
      task_link: `${appBaseUrl()}/tasks/${inst.id}`,
    },
  });

  return NextResponse.json({ ok: true, sent: result.ok, skipped: result.skipped ?? null });
}
