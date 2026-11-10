"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "invalid";

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");
  // The token is single-use: make sure it's only exchanged once even if React re-runs the effect.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const tokenHash = params.get("token_hash");
    if (!tokenHash || params.get("type") !== "recovery") {
      // One-time read of the link's query string on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("invalid");
      return;
    }

    // Exchanged here, in the browser, rather than by following Supabase's own
    // verification URL: it doesn't depend on the project's allowed-redirect
    // list, and an email scanner that merely fetches this page can't use up
    // the one-time token (it only runs when JavaScript does).
    createClient()
      .auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      .then(({ error }) => {
        if (error) setStatus("invalid");
        else router.replace("/set-password");
      });
  }, [params, router]);

  return (
    <div className="w-[380px] max-w-[calc(100vw-24px)] bg-panel-bg border border-panel-border rounded-xl px-8 py-9 shadow-sm text-center">
      <div className="w-12 h-12 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[17px] mx-auto mb-4">
        TM
      </div>
      {status === "checking" ? (
        <div className="text-[13.5px] text-text-sub">Checking your link…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-[13px] text-danger">This link is invalid or has expired.</div>
          <Link href="/forgot-password" className="text-[13px] font-semibold text-accent">
            Send me a new link
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div className="flex-1 min-h-full flex items-center justify-center bg-sidebar-bg">
      <Suspense fallback={null}>
        <ConfirmInner />
      </Suspense>
    </div>
  );
}
