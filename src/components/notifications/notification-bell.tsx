"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications } from "./notification-provider";
import { enablePush, usePwa } from "@/components/pwa/pwa-state";
import { timeAgo } from "@/lib/time-ago";
import type { NotificationRow } from "@/lib/notification-shared";

function Item({ n, onOpen, onAck }: { n: NotificationRow; onOpen: (n: NotificationRow) => void; onAck?: (id: string) => void }) {
  const critical = n.level === "critical";
  return (
    <div
      className="px-3.5 py-2.5 border-b border-row-hover-border last:border-b-0"
      style={{
        borderLeft: critical ? "3px solid var(--danger)" : "3px solid transparent",
        background: !n.read_at ? "var(--accent-soft)" : "transparent",
      }}
    >
      <button type="button" onClick={() => onOpen(n)} className="w-full text-left border-none bg-transparent cursor-pointer p-0">
        <div className="flex items-start justify-between gap-2">
          <div className={`text-[13px] text-text-main ${n.read_at ? "font-semibold" : "font-bold"}`}>{n.title}</div>
          <div className="text-[10.5px] text-text-faint shrink-0 mt-0.5">{timeAgo(n.created_at)}</div>
        </div>
        {n.body ? <div className="text-[12px] text-text-sub mt-0.5 line-clamp-2">{n.body}</div> : null}
      </button>
      {critical && !n.acknowledged_at && onAck ? (
        <button
          type="button"
          onClick={() => onAck(n.id)}
          className="mt-1.5 border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-[11.5px] font-semibold cursor-pointer"
        >
          Acknowledge
        </button>
      ) : null}
    </div>
  );
}

/** Bell in the top bar: critical alerts pinned on top, general updates below. */
export function NotificationBell() {
  const { items, unread, openCritical, markRead, markAllRead, acknowledge } = useNotifications();
  const pwa = usePwa();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const critical = items.filter((n) => n.level === "critical" && !n.acknowledged_at).slice(0, 6);
  const updates = items.filter((n) => n.level !== "critical" || n.acknowledged_at).slice(0, 8);
  const hasCritical = openCritical.length > 0;

  function openItem(n: NotificationRow) {
    markRead([n.id]);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative w-10 h-10 rounded-full border border-panel-border bg-panel-bg text-text-body cursor-pointer flex items-center justify-center"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10.5px] font-bold flex items-center justify-center ${hasCritical ? "tm-blink" : ""}`}
            style={{ background: hasCritical ? "var(--danger)" : "var(--accent)" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(390px,calc(100vw-24px))] bg-panel-bg border border-panel-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-panel-border">
            <div className="text-[14px] font-bold text-text-main">Notifications</div>
            <button type="button" onClick={markAllRead} className="border-none bg-transparent text-accent text-[12px] font-semibold cursor-pointer">
              Mark updates read
            </button>
          </div>
          <div className="max-h-[min(480px,70dvh)] overflow-y-auto">
            {critical.length > 0 ? (
              <div>
                <div className="px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-danger bg-table-head-bg">Critical alerts</div>
                {critical.map((n) => (
                  <Item key={n.id} n={n} onOpen={openItem} onAck={acknowledge} />
                ))}
              </div>
            ) : null}
            <div>
              <div className="px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-text-sub bg-table-head-bg">Updates</div>
              {updates.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-[12.5px] text-text-faint">You&apos;re all caught up.</div>
              ) : (
                updates.map((n) => <Item key={n.id} n={n} onOpen={openItem} />)
              )}
            </div>
          </div>
          {pwa.supported && !pwa.subscribed && pwa.permission !== "denied" ? (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-accent-soft border-t border-panel-border">
              <span className="text-[12px] text-text-body">Get alerts on this device, even when closed.</span>
              <button type="button" onClick={() => void enablePush()} disabled={pwa.busy} className="border-none bg-accent text-white px-2.5 py-1 rounded-md text-[12px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60">
                Turn on
              </button>
            </div>
          ) : null}
          <Link href="/notifications" onClick={() => setOpen(false)} className="block text-center px-3.5 py-2.5 border-t border-panel-border text-[12.5px] font-semibold text-accent">
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
