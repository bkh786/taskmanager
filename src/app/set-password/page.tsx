"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid";

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase redirects invite/magic-link errors back as hash params
    // instead of a session, e.g. #error=access_denied&error_code=otp_expired.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const hashError = hash.get("error_description");
    if (hashError) {
      // One-time read of a browser-only external signal (the URL Supabase
      // redirected back to) on mount -- not derivable from props/state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkError(hashError.replace(/\+/g, " "));
      setStatus("invalid");
      return;
    }

    const supabase = createClient();

    // Supabase's /auth/v1/verify (used by invite/recovery links) redirects
    // with the older implicit-flow hash tokens (#access_token=...), but
    // @supabase/ssr's browser client defaults to the PKCE flow (expects a
    // ?code= param) and won't pick these up automatically. Set the session
    // from the hash explicitly instead of relying on auto-detection.
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data }) => setStatus(data.session ? "ready" : "invalid"));
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setStatus(session ? "ready" : "invalid");
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg">
      <div className="w-[380px] bg-panel-bg border border-panel-border rounded-xl px-8 py-9 shadow-sm">
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="w-12 h-12 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[17px]">
            TM
          </div>
          <div className="text-center">
            <div className="text-[18px] font-bold text-text-main">Task Manager</div>
            <div className="text-[13px] text-text-sub mt-0.5">
              {status === "ready" ? "Set your password" : "Accept invitation"}
            </div>
          </div>
        </div>

        {status === "checking" ? (
          <div className="text-[13.5px] text-text-sub text-center">Checking your invite link…</div>
        ) : status === "invalid" ? (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] text-danger">
              {linkError ?? "This invite link is invalid or has expired."}
            </div>
            <div className="text-[12.5px] text-text-sub">
              Ask whoever invited you to send a new invite, then use that link instead.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm bg-panel-bg text-text-main"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm bg-panel-bg text-text-main"
              />
            </div>
            {formError ? <div className="text-[12.5px] text-danger">{formError}</div> : null}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1.5 w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-md text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Set password and continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
