"use client";

import { useEffect } from "react";
import { signOutIdle } from "@/app/(app)/actions";

const LIMIT_MS = 60 * 60 * 1000; // 60 minutes without activity
const KEY = "tm-last-activity";

/**
 * Signs the user out after an hour of inactivity. Activity in ANY open tab of
 * the portal counts (the timestamp is shared through localStorage), and the
 * check also runs when a sleeping phone/laptop wakes up.
 */
export function IdleLogout() {
  useEffect(() => {
    let lastLocal = Date.now();
    const read = () => {
      try {
        return Math.max(lastLocal, Number(localStorage.getItem(KEY)) || 0);
      } catch {
        return lastLocal;
      }
    };
    const stamp = () => {
      lastLocal = Date.now();
      try {
        localStorage.setItem(KEY, String(lastLocal));
      } catch {
        // storage unavailable: this tab's own timer still works
      }
    };
    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle > 5000) {
        throttle = now;
        stamp();
      }
    };
    let signingOut = false;
    const check = () => {
      if (signingOut) return;
      if (Date.now() - read() >= LIMIT_MS) {
        signingOut = true;
        void signOutIdle();
      }
    };

    stamp();
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      clearInterval(timer);
    };
  }, []);

  return null;
}
