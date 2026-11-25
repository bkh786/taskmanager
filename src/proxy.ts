import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * True while the signed-in session's access token is comfortably inside its lifetime,
 * or when there is no session at all. In both cases there is nothing to refresh, so the
 * (comparatively costly) Supabase client + token check can be skipped. Any doubt -- an
 * unexpected cookie shape, a token about to expire -- returns false and the full path runs.
 * Pages and actions still verify the token themselves (getCurrentAppUser), so skipping
 * here never lets anyone in; it only avoids refreshing work nobody needs.
 */
function sessionNeedsNoRefresh(request: NextRequest): boolean {
  try {
    const chunks = request.cookies
      .getAll()
      .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => Number(a.name.split(".")[1] ?? 0) - Number(b.name.split(".")[1] ?? 0));
    if (chunks.length === 0) return true;
    let raw = chunks.map((c) => c.value).join("");
    if (raw.startsWith("base64-")) {
      raw = Buffer.from(raw.slice(7), "base64url").toString("utf8");
    }
    const session = JSON.parse(raw) as { access_token?: string };
    const payload = session.access_token?.split(".")[1];
    if (!payload) return false;
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof exp === "number" && exp - Date.now() / 1000 > 120;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  if (sessionNeedsNoRefresh(request)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Refresh the session if expired. Required for Server Components, which
  // cannot write cookies themselves. getClaims validates the token locally
  // (no Supabase Auth round trip) and refreshes it only when it has expired.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Not for anything with a file extension (scripts, manifest, icons, the offline
    // page, fonts...) nor the cron endpoint, which has its own secret and no session.
    "/((?!_next/static|_next/image|api/cron|.*\\..*).*)",
  ],
};
