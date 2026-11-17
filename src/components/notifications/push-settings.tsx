"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { disablePush, enablePush, promptInstall, usePwa } from "@/components/pwa/pwa-state";

/** This device's alert settings: install the app, push on/off, what to push, and a test. */
export function PushSettings({ userId }: { userId: string }) {
  const pwa = usePwa();
  const [prefs, setPrefs] = useState({ push_info: true, push_critical: true, push_chat: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.from("notification_prefs").select("push_info, push_critical, push_chat").eq("user_id", userId).maybeSingle();
      if (data) setPrefs(data);
    })();
  }, [userId]);

  async function savePref(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await createClient().from("notification_prefs").upsert({ user_id: userId, ...next });
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? "Test sent. It should appear in a few seconds." : (j.error ?? "Couldn't send the test."));
    setTesting(false);
  }

  const blocked = pwa.permission === "denied";
  const needsInstall = pwa.ios && !pwa.installed;

  return (
    <div className="bg-panel-bg border border-panel-border rounded-xl px-5 py-4 flex flex-col gap-3.5">
      <div>
        <div className="text-[15px] font-bold text-text-main">Alerts on this device</div>
        <div className="text-[12.5px] text-text-sub mt-0.5">
          Get notifications even when the app is closed, and install Task Manager like an app.
        </div>
      </div>

      {!pwa.installed ? (
        <div className="flex items-center justify-between gap-3 flex-wrap border border-panel-border rounded-lg px-3.5 py-2.5">
          <div className="text-[13px] text-text-body">
            <span className="font-semibold">Install the app</span>
            <div className="text-[12px] text-text-sub">
              {pwa.canInstall
                ? "Adds Task Manager to your home screen or desktop."
                : pwa.ios
                  ? "On iPhone/iPad: tap Share, then “Add to Home Screen”."
                  : "Use your browser's menu: “Install Task Manager” (or “Add to Home screen”)."}
            </div>
          </div>
          {pwa.canInstall ? (
            <button type="button" onClick={() => void promptInstall()} className="border-none bg-accent text-white px-3.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer">
              Install
            </button>
          ) : null}
        </div>
      ) : (
        <div className="text-[12.5px] text-success">✓ Running as an installed app.</div>
      )}

      {!pwa.supported ? (
        <div className="text-[12.5px] text-text-faint">
          {needsInstall
            ? "On iPhone/iPad, notifications work once the app is added to the home screen (iOS 16.4 or later)."
            : "This browser doesn't support push notifications."}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[13px] text-text-body">
              Push notifications:{" "}
              <span className={pwa.subscribed ? "font-bold text-success" : "font-bold text-text-sub"}>
                {pwa.subscribed ? "On" : "Off"}
              </span>
              {blocked ? <span className="text-danger"> · blocked in browser settings</span> : null}
            </div>
            <div className="flex gap-2">
              {pwa.subscribed ? (
                <>
                  <button type="button" disabled={testing} onClick={() => void test()} className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer disabled:opacity-60">
                    {testing ? "Sending…" : "Send a test"}
                  </button>
                  <button type="button" disabled={pwa.busy} onClick={() => void disablePush()} className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer disabled:opacity-60">
                    Turn off
                  </button>
                </>
              ) : (
                <button type="button" disabled={pwa.busy || blocked} onClick={() => void enablePush()} className="border-none bg-accent text-white px-3.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-60">
                  {pwa.busy ? "Turning on…" : "Turn on"}
                </button>
              )}
            </div>
          </div>
          {pwa.subscribed ? (
            <div className="flex flex-col gap-1.5 text-[12.5px] text-text-body">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.push_critical} onChange={(e) => void savePref({ push_critical: e.target.checked })} />
                Critical alerts (overdue tasks)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.push_info} onChange={(e) => void savePref({ push_info: e.target.checked })} />
                General updates (completed tasks, announcements)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.push_chat} onChange={(e) => void savePref({ push_chat: e.target.checked })} />
                Chat messages and incoming calls
              </label>
            </div>
          ) : null}
          {pwa.error ? <div className="text-[12.5px] text-danger">{pwa.error}</div> : null}
          {msg ? <div className="text-[12.5px] text-text-sub">{msg}</div> : null}
        </>
      )}
    </div>
  );
}
