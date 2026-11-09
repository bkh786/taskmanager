"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Signed out by the idle timer: back to the sign-in page with a note about why. */
export async function signOutIdle() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?reason=idle");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
