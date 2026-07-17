import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrgEmail } from "@/lib/email";

/**
 * Relay used by the send-reminders Supabase Edge Function to actually
 * dispatch SMTP mail. Edge Functions run in a sandboxed V8 isolate that
 * doesn't reliably support raw TCP (SMTP) connections -- Supabase's own
 * docs point to an HTTP-API email provider (Resend) for that reason. Since
 * this app needs arbitrary per-org SMTP (not a single fixed provider), the
 * Edge Function does the scheduling/classification/dedup logic and calls
 * this route (Node runtime, where Nodemailer/raw SMTP is already proven
 * to work) for the actual send.
 *
 * Authenticated by shared secret (CRON_SECRET), not a user session -- there
 * is no session in this call path.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { orgId, to, subject, html, notifType, taskInstanceId } = body as {
    orgId?: string;
    to?: string;
    subject?: string;
    html?: string;
    notifType?: string;
    taskInstanceId?: string | null;
  };

  if (!orgId || !to || !subject || !html || !notifType) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("organizations")
    .select("id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email")
    .eq("id", orgId)
    .single();
  if (error || !org) {
    return NextResponse.json({ error: "org not found" }, { status: 404 });
  }

  await sendOrgEmail(org, { to, subject, html, notifType, taskInstanceId }, admin);

  return NextResponse.json({ ok: true });
}
