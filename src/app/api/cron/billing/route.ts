import { NextResponse } from "next/server";
import { runBilling } from "@/lib/billing";

export const maxDuration = 300;

/** Today's date in India (the platform's billing calendar), as YYYY-MM-DD. */
function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Daily billing job (Vercel Cron): raises invoices for cycles starting today,
 * sends the invoice + billing reminder, and flags overdue invoices.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; `x-cron-secret` also works.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-cron-secret");
  if (!secret || (bearer !== secret && header !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runBilling(todayIst());
  return NextResponse.json(summary);
}
