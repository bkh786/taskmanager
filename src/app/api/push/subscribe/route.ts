import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string };

function validEndpoint(e: string): boolean {
  try {
    const u = new URL(e);
    return u.protocol === "https:" && e.length < 2048;
  } catch {
    return false;
  }
}

/** Registers this device for push notifications for the signed-in person. */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  const { endpoint, keys } = body;
  if (!endpoint || !validEndpoint(endpoint) || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const admin = createAdminClient();
  // A device belongs to whoever is signed in on it now.
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: appUser.id,
      org_id: appUser.org_id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: (body.userAgent ?? "").slice(0, 300) || null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Removes this device. */
export async function DELETE(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as Body;
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", appUser.id);
  return NextResponse.json({ ok: true });
}
