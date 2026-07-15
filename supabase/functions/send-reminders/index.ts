// Deno Edge Function, invoked by pg_cron every 15 minutes (see the
// schedule_reminder_cron migration). For each active org whose
// organizations.reminder_time falls in the last 15 minutes (server/UTC
// clock -- there's no per-org timezone column in the schema), sends one
// reminder email per non-completed, non-removed, reminder_enabled task
// instance: "upcoming" (due today), "delayed" (overdue), or "missed"
// (overdue 3+ days). Skips an org if a reminder batch was already sent
// today, so re-running the same 15-minute window twice is a no-op.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

type Org = {
  id: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_from_email: string | null;
  reminder_time: string | null;
};

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

async function sendReminderEmail(
  org: Org,
  to: string,
  bucket: Bucket,
  taskName: string,
  dueDateFormatted: string
): Promise<boolean> {
  if (!org.smtp_host || !org.smtp_port || !org.smtp_from_email) return false;

  const subject =
    bucket === "upcoming"
      ? `Reminder: "${taskName}" is due today`
      : bucket === "delayed"
        ? `Overdue: "${taskName}" was due ${dueDateFormatted}`
        : `Still not done: "${taskName}" was due ${dueDateFormatted}`;

  try {
    const client = new SMTPClient({
      connection: {
        hostname: org.smtp_host,
        port: org.smtp_port,
        tls: org.smtp_port === 465,
        auth: org.smtp_username
          ? { username: org.smtp_username, password: org.smtp_password ?? "" }
          : undefined,
      },
    });
    await client.send({
      from: org.smtp_from_email,
      to,
      subject,
      content: subject,
      html: `<p>${subject}</p>`,
    });
    await client.close();
    return true;
  } catch (err) {
    console.error(`reminder send failed for org ${org.id}:`, err);
    return false;
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const nowHHMM = now.toISOString().slice(11, 16);
  const todayIso = now.toISOString().slice(0, 10);

  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, reminder_time")
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

      const ok = await sendReminderEmail(
        org as Org,
        assignee.email,
        bucket,
        task.task_name,
        inst.due_date
      );
      await supabase.from("notification_log").insert({
        org_id: org.id,
        task_instance_id: inst.id,
        notif_type: `reminder_${bucket}`,
        recipient_email: assignee.email,
        status: ok ? "sent" : "failed",
      });
      if (ok) sentCount++;
    }
    summary[org.id] = sentCount;
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { "content-type": "application/json" },
  });
});
