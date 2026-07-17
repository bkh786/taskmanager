"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth";
import type { LoginState } from "./types";

export async function signIn(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("system_role, is_active, organizations(slug)")
    .eq("id", data.user.id)
    .single();

  if (!appUser || !appUser.is_active) {
    await supabase.auth.signOut();
    return {
      error: "This account is inactive or not provisioned. Contact your admin.",
    };
  }

  // Remembers this browser's org so a future visit to a bare /login (no
  // ?org=slug) still shows the right branding, without needing subdomains.
  const orgSlug = (appUser.organizations as { slug: string } | null)?.slug;
  if (orgSlug) {
    const cookieStore = await cookies();
    cookieStore.set("tm-org", orgSlug, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      path: "/",
    });
  }

  redirect(roleHome(appUser.system_role));
}
