import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushDirect } from "@/lib/notify";

/**
 * Called by the caller's browser right after a call is placed: rings the callee's devices.
 * Only the caller can trigger it, only once per call, and only while it is still ringing.
 */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser || !appUser.org_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { callId } = (await request.json().catch(() => ({}))) as { callId?: string };
  if (!callId || !/^[0-9a-f-]{36}$/i.test(callId)) {
    return NextResponse.json({ error: "Invalid call" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("chat_calls")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", callId)
    .eq("caller_id", appUser.id)
    .eq("org_id", appUser.org_id)
    .eq("status", "ringing")
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString())
    .select("id, callee_id, kind")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true, devices: 0 });

  const devices = await pushDirect(claimed.callee_id, {
    kind: "call",
    title: `${appUser.full_name} is calling`,
    body: claimed.kind === "video" ? "Incoming video call" : "Incoming voice call",
    url: "/team-chat",
    tag: `call-${claimed.id}`,
    // A call is only worth ringing for about as long as it rings.
    ttl: 45,
    vibrate: [300, 150, 300, 150, 300],
  });
  return NextResponse.json({ ok: true, devices });
}
