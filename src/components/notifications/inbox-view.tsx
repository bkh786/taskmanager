"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotifications } from "./notification-provider";
import { timeAgo } from "@/lib/time-ago";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "critical", label: "Critical" },
  { id: "updates", label: "Updates" },
] as const;

export function InboxView() {
  const { items, ready, unread, markRead, markAllRead, acknowledge, remove, loadOlder } = useNotifications();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const list = items.filter((n) =>
    filter === "unread" ? !n.read_at : filter === "critical" ? n.level === "critical" : filter === "updates" ? n.level !== "critical" : true
  );

  return (
    <div className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-panel-border">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="border px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer"
              style={{
                borderColor: filter === f.id ? "var(--accent)" : "var(--panel-border)",
                background: filter === f.id ? "var(--accent-soft)" : "transparent",
                color: filter === f.id ? "var(--accent)" : "var(--text-body)",
              }}
            >
              {f.label}
              {f.id === "unread" && unread > 0 ? ` (${unread})` : ""}
            </button>
          ))}
        </div>
        <button type="button" onClick={markAllRead} className="border-none bg-transparent text-accent text-[12.5px] font-semibold cursor-pointer">
          Mark updates as read
        </button>
      </div>

      {!ready ? (
        <div className="px-4 py-8 text-center text-[13px] text-text-faint">Loading…</div>
      ) : list.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-text-faint">Nothing here.</div>
      ) : (
        list.map((n) => {
          const critical = n.level === "critical";
          return (
            <div
              key={n.id}
              className="flex gap-3 px-4 py-3 border-b border-row-hover-border last:border-b-0"
              style={{ borderLeft: critical ? "3px solid var(--danger)" : "3px solid transparent", background: !n.read_at ? "var(--accent-soft)" : "transparent" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {critical ? <span className="text-[10px] font-bold uppercase text-white rounded px-1.5 py-0.5" style={{ background: "var(--danger)" }}>Critical</span> : null}
                  <span className={`text-[13.5px] text-text-main ${n.read_at ? "font-semibold" : "font-bold"}`}>{n.title}</span>
                  <span className="text-[11px] text-text-faint">{timeAgo(n.created_at)}</span>
                </div>
                {n.body ? <div className="text-[12.5px] text-text-sub mt-0.5">{n.body}</div> : null}
                <div className="flex gap-3 mt-1.5 text-[12px] font-semibold">
                  {n.link ? (
                    <Link prefetch={false} href={n.link} onClick={() => markRead([n.id])} className="text-accent">
                      Open
                    </Link>
                  ) : null}
                  {!n.read_at && !critical ? (
                    <button type="button" onClick={() => markRead([n.id])} className="border-none bg-transparent text-text-sub cursor-pointer p-0 font-semibold">
                      Mark read
                    </button>
                  ) : null}
                  {critical && !n.acknowledged_at ? (
                    <button type="button" onClick={() => acknowledge(n.id)} className="border-none bg-transparent text-danger cursor-pointer p-0 font-semibold">
                      Acknowledge
                    </button>
                  ) : null}
                  {!critical || n.acknowledged_at ? (
                    <button type="button" onClick={() => remove([n.id])} className="border-none bg-transparent text-text-faint cursor-pointer p-0 font-semibold">
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
      )}

      {ready && more && items.length > 0 ? (
        <div className="px-4 py-3 text-center border-t border-panel-border">
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setMore(await loadOlder());
              setLoading(false);
            }}
            className="border border-panel-border bg-panel-bg text-text-body px-4 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load older"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
