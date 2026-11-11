import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";

/**
 * Network helpers for a call (STUN / TURN). Only signed-in people get them.
 *
 *  - STUN lets two browsers find each other directly; it is always included.
 *  - TURN relays the (still end-to-end encrypted) media when a direct path is
 *    blocked by a strict firewall. Configure it with:
 *      TURN_URLS="turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349"
 *    and either TURN_SECRET (coturn "use-auth-secret": short-lived credentials are
 *    issued per request) or TURN_USERNAME + TURN_CREDENTIAL (a static account).
 *  - STUN_URLS overrides the default public STUN server.
 */
export async function GET() {
  const appUser = await getCurrentAppUser();
  if (!appUser || !appUser.org_id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const stun = (process.env.STUN_URLS ?? "stun:stun.l.google.com:19302")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: stun },
  ];

  const turnUrls = (process.env.TURN_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (turnUrls.length > 0) {
    const secret = process.env.TURN_SECRET;
    if (secret) {
      // Valid for one hour; the username carries the expiry (coturn REST scheme).
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const username = `${expiry}:${appUser.id}`;
      const credential = createHmac("sha1", secret).update(username).digest("base64");
      iceServers.push({ urls: turnUrls, username, credential });
    } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      iceServers.push({
        urls: turnUrls,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }
  }

  return NextResponse.json(
    { iceServers, relay: iceServers.length > 1 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
