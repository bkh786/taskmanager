"use client";

import Link from "next/link";
import { useNotifications } from "./notification-provider";

/** Pinned across the top while a critical alert is unacknowledged, and a toast for new arrivals. */
export function CriticalBanner() {
  const { openCritical, acknowledge, markRead, toast, dismissToast } = useNotifications();
  const top = openCritical[0];
  const showToast = toast && toast.level !== "critical";

  return (
    <>
      {top ? (
        <div
          role="alert"
          className="mb-3 flex items-center gap-x-3 gap-y-2 flex-wrap rounded-lg px-3.5 sm:px-4 py-2.5 text-white"
          style={{ background: "var(--danger)" }}
        >
          <span aria-hidden="true" className="text-[16px]">⚠</span>
          <div className="min-w-0 flex-1 basis-[200px] text-[13px] line-clamp-3 sm:line-clamp-none">
            <span className="font-bold">{top.title}</span>
            {top.body ? <span className="opacity-90"> — {top.body}</span> : null}
            {openCritical.length > 1 ? <span className="ml-2 font-semibold">(+{openCritical.length - 1} more)</span> : null}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {top.link ? (
              <Link href={top.link} onClick={() => markRead([top.id])} className="text-white underline text-[12.5px] font-semibold">
                View
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => acknowledge(top.id)}
              className="border border-white/60 bg-transparent text-white px-3 py-1 rounded-md text-[12px] font-semibold cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        </div>
      ) : null}
      {showToast ? (
        <div role="status" className="fixed top-4 right-4 z-[65] w-[min(340px,calc(100vw-24px))] bg-panel-bg border border-panel-border rounded-xl shadow-2xl px-4 py-3 flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-text-main">{toast.title}</div>
            {toast.body ? <div className="text-[12px] text-text-sub mt-0.5 line-clamp-2">{toast.body}</div> : null}
            {toast.link ? (
              <Link href={toast.link} onClick={() => { markRead([toast.id]); dismissToast(); }} className="text-[12px] font-semibold text-accent mt-1 inline-block">
                Open
              </Link>
            ) : null}
          </div>
          <button type="button" onClick={dismissToast} aria-label="Dismiss" className="border-none bg-transparent text-text-faint text-[18px] leading-none cursor-pointer self-start">
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
