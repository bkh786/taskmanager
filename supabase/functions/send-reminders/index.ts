// Deno Edge Function, invoked by pg_cron every 15 minutes (see the
// schedule_reminder_cron migration). For each active org whose
// organizations.reminder_time falls in the last 15 minutes (server/UTC
// clock -- there's no per-org timezone column in the schema), classifies
// every non-completed, non-removed, reminder_enabled task instance as
// "upcoming" (due today), "delayed" (overdue), or "missed" (overdue 3+
// days), and hands the actual send off to the Next.js app's /api/send-email
// route (Node runtime -- raw SMTP to an arbitrary per-org server doesn't
// reliably work inside the Edge Runtime's sandboxed isolate, which is why
// Supabase's own docs point to an HTTP-API provider like Resend for
// Edge Function email; this app needs arbitrary per-org SMTP instead, so
// the send itself happens where TCP sockets are actually supported).
// Skips an org if a reminder batch was already sent today, so re-running
// the same 15-minute window twice is a no-op.
import { createClient } from "jsr:@supabase/supabase-js@2";

type Bucket = "upcoming" | "delayed" | "missed";

function classify(dueDate: string, todayIso: string): Bucket | null {
  if (dueDate === todayIso) return "upcoming";
  if (dueDate < todayIso) {
    const diffDays = Math.floor(
      (Date.parse(todayIso) - Date.parse(dueDate)) / 86400000
    );
    return diffDays >= 3 ? "missed" : "delayed";
  }
  return null;
}

function isWithinWindow(nowHHMM: string, targetHHMM: string, windowMinutes: number): boolean {
  const toMinutes = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const diff = toMinutes(nowHHMM) - toMinutes(targetHHMM);
  return diff >= 0 && diff < windowMinutes;
}

async function relayEmail(
  appUrl: string,
  cronSecret: string,
  payload: {
    orgId: string;
    to: string;
    subject: string;
    html: string;
    notifType: string;
    taskInstanceId: string;
  }
): Promise<boolean> {
  try {
    const res = await fetch(`${appUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("relay to /api/send-email failed:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  // app_url/cron_secret are passed in the request body (set by the pg_cron
  // job) rather than as Edge Function secrets, so they can be updated by
  // editing the cron job instead of redeploying.
  const { app_url, cron_secret } = await req.json().catch(() => ({}));
  if (!app_url || !cron_secret) {
    return new Response(
      JSON.stringify({ error: "app_url and cron_secret are required in the request body" }),
      { status: 400 }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const nowHHMM = now.toISOString().slice(11, 16);
  const todayIso = now.toISOString().slice(0, 10);

  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, reminder_time")
    .eq("is_active", true);
  if (orgsError) {
    return new Response(JSON.stringify({ error: orgsError.message }), { status: 500 });
  }

  const summary: Record<string, number> = {};

  for (const org of orgs ?? []) {
    if (!org.reminder_time) continue;
    if (!isWithinWindow(nowHHMM, org.reminder_time.slice(0, 5), 15)) continue;

    const { count: alreadySent } = await supabase
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .in("notif_type", ["reminder_upcoming", "reminder_delayed", "reminder_missed"])
      .gte("sent_at", `${todayIso}T00:00:00Z`);
    if ((alreadySent ?? 0) > 0) continue;

    const { data: instances } = await supabase
      .from("task_instances")
      .select(
        `id, due_date,
         assignee:app_users!task_instances_assignee_id_fkey(email),
         task:tasks!task_instances_task_id_fkey(task_name, reminder_enabled, org_id)`
      )
      .eq("removed", false)
      .neq("status", "completed");

    let sentCount = 0;
    for (const inst of instances ?? []) {
      const task = Array.isArray(inst.task) ? inst.task[0] : inst.task;
      const assignee = Array.isArray(inst.assignee) ? inst.assignee[0] : inst.assignee;
      if (!task || task.org_id !== org.id || !task.reminder_enabled) continue;
      if (!assignee?.email) continue;

      const bucket = classify(inst.due_date, todayIso);
      if (!bucket) continue;

      const subject =
        bucket === "upcoming"
          ? `Reminder: "${task.task_name}" is due today`
          : bucket === "delayed"
            ? `Overdue: "${task.task_name}" was due ${inst.due_date}`
            : `Still not done: "${task.task_name}" was due ${inst.due_date}`;

      const ok = await relayEmail(app_url, cron_secret, {
        orgId: org.id,
        to: assignee.email,
        subject,
        html: `<p>${subject}</p>`,
        notifType: `reminder_${bucket}`,
        taskInstanceId: inst.id,
      });
      if (ok) sentCount++;
      // /api/send-email logs to notification_log itself (success or
      // failure) via sendOrgEmail, so no separate logging call here.
    }
    summary[org.id] = sentCount;
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { "content-type": "application/json" },
  });
});
