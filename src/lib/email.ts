import "server-only";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

type OrgSmtp = Pick<
  Tables<"organizations">,
  "id" | "smtp_host" | "smtp_port" | "smtp_username" | "smtp_password" | "smtp_from_email"
>;

/**
 * Sends an email via the org's own SMTP config and logs the outcome to
 * notification_log. Never throws -- email is a side effect of task actions,
 * not a dependency they should fail on. Silently no-ops if the org hasn't
 * configured SMTP yet.
 */
export async function sendOrgEmail(
  org: OrgSmtp,
  opts: {
    to: string;
    subject: string;
    html: string;
    notifType: string;
    taskInstanceId?: string | null;
  }
): Promise<void> {
  const supabase = await createClient();

  if (!org.smtp_host || !org.smtp_port || !org.smtp_from_email) {
    await supabase.from("notification_log").insert({
      org_id: org.id,
      task_instance_id: opts.taskInstanceId ?? null,
      notif_type: opts.notifType,
      recipient_email: opts.to,
      status: "skipped_no_smtp_config",
    });
    return;
  }

  try {
    const transport = nodemailer.createTransport({
      host: org.smtp_host,
      port: org.smtp_port,
      secure: org.smtp_port === 465,
      auth: org.smtp_username
        ? { user: org.smtp_username, pass: org.smtp_password ?? "" }
        : undefined,
    });

    await transport.sendMail({
      from: org.smtp_from_email,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    await supabase.from("notification_log").insert({
      org_id: org.id,
      task_instance_id: opts.taskInstanceId ?? null,
      notif_type: opts.notifType,
      recipient_email: opts.to,
      status: "sent",
    });
  } catch (err) {
    await supabase.from("notification_log").insert({
      org_id: org.id,
      task_instance_id: opts.taskInstanceId ?? null,
      notif_type: opts.notifType,
      recipient_email: opts.to,
      status: `failed: ${err instanceof Error ? err.message : "unknown error"}`.slice(0, 250),
    });
  }
}
