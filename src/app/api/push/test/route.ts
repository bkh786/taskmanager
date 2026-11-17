import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createNotifications, pushConfigured } from "@/lib/notify";

/** Sends a test notification (in-app and push) to the signed-in person. */
export async function POST() {
  const appUser = await getCurrentAppUser();
  if (!appUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Push isn't set up on the server yet." }, { status: 503 });
  }
  const n = await createNotifications(
    [
      {
        org_id: appUser.org_id,
        user_id: appUser.id,
        level: "info",
        kind: "test",
        title: "Test notification",
        body: "If you can read this on your device, notifications are working.",
        link: "/notifications",
        source: "system",
      },
    ],
    { push: true }
  );
  return NextResponse.json({ ok: n > 0 });
}
