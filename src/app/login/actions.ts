"use server";

import { redirect } from "next/navigation";
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
    .select("system_role, is_active")
    .eq("id", data.user.id)
    .single();

  if (!appUser || !appUser.is_active) {
    await supabase.auth.signOut();
    return {
      error: "This account is inactive or not provisioned. Contact your admin.",
    };
  }

  redirect(roleHome(appUser.system_role));
}
