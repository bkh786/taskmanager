"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl, createPasswordLink, sendOrgEvent } from "@/lib/email";
import { isValidEmail } from "@/lib/email-events";

export type ForgotState = { error: string | null; done: boolean };

/**
 * Always answers the same way whether or not the address has an account, so
 * this can't be used to discover who is registered. The email itself is built
 * and sent in the background, from the user's own organization's SMTP.
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return { error: "Enter a valid email address.", done: false };

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("app_users")
    .select("full_name, org_id, is_active")
    .eq("email", email)
    .maybeSingle();

  if (user && user.is_active !== false) {
    // At most one reset email per address per minute.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("notif_type", "password_reset")
      .eq("recipient_email", email)
      .gte("sent_at", since);

    if (!count) {
      after(async () => {
        const link = await createPasswordLink(email);
        if (!link) return;

        const redirectTo = `${appBaseUrl()}/set-password`;
        if (user.org_id) {
          const result = await sendOrgEvent({
            orgId: user.org_id,
            event: "password_reset",
            to: email,
            vars: { user_name: user.full_name, reset_link: link },
          });
          // The org hasn't set up SMTP yet: fall back to Supabase's own mailer
          // so people aren't locked out.
          if (result.skipped === "no_smtp") {
            await admin.auth.resetPasswordForEmail(email, { redirectTo });
          }
        } else {
          // Platform owners belong to no organization (no SMTP of their own).
          await admin.auth.resetPasswordForEmail(email, { redirectTo });
        }
      });
    }
  }

  return { error: null, done: true };
}
