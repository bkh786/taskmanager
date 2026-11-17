import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/notify";

export const maxDuration = 300;

/**
 * Alert job (every 10 minutes, scheduled in Supabase with pg_cron): fires overdue
 * escalation steps and sends announcements whose time has come.
 * Authenticated with the shared cron secret.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-cron-secret");
  if (!secret || (bearer !== secret && header !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Optional ?org=<id> limits a run to one organization (handy for checking a single tenant).
  const org = new URL(request.url).searchParams.get("org") ?? undefined;
  return NextResponse.json(await runAlerts({ orgId: org }));
}

export const GET = handle;
export const POST = handle;
