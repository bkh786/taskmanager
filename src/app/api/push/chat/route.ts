import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushDirect } from "@/lib/notify";

/**
 * Called by the sender's browser right after a chat message is saved: pushes it to the
 * recipient's devices. Only the author can trigger it, only once per message, and only
 * for a message that is still fresh.
 */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser || !appUser.org_id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { messageId } = (await request.json().catch(() => ({}))) as { messageId?: string };
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Claim the message so a replay can never push it twice.
  const { data: claimed } = await admin
    .from("chat_messages")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", appUser.id)
    .eq("org_id", appUser.org_id)
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .select("id, recipient_id, body")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true, devices: 0 });

  // A burst of messages from one person is one buzz, not twenty.
  const { count: recent } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", appUser.id)
    .eq("recipient_id", claimed.recipient_id)
    .neq("id", messageId)
    .gte("pushed_at", new Date(Date.now() - 8_000).toISOString());
  if ((recent ?? 0) > 0) return NextResponse.json({ ok: true, devices: 0, coalesced: true });

  const body = claimed.body.length > 120 ? `${claimed.body.slice(0, 117)}…` : claimed.body;
  const devices = await pushDirect(claimed.recipient_id, {
    kind: "chat",
    title: appUser.full_name,
    body,
    url: `/team-chat?with=${appUser.id}`,
    tag: `chat-${appUser.id}`,
  });
  return NextResponse.json({ ok: true, devices });
}
