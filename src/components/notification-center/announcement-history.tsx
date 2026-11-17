"use client";

import { useState, useTransition } from "react";
import { cancelAnnouncement, withdrawAnnouncement } from "@/app/(app)/notification-center/actions";

export type AnnouncementRow = {
  id: string;
  title: string;
  level: string;
  status: string;
  audience: string;
  when: string;
  recipients: number;
  read: number;
};

const STATUS: Record<string, { label: string; color: string }> = {
  sent: { label: "Sent", color: "var(--success)" },
  scheduled: { label: "Scheduled", color: "var(--accent)" },
  cancelled: { label: "Cancelled", color: "var(--text-faint)" },
  withdrawn: { label: "Withdrawn", color: "var(--text-faint)" },
};

export function AnnouncementHistory({ rows }: { rows: AnnouncementRow[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function act(fn: () => Promise<{ error: string | null }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
    });
  }

  return (
    <div className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-panel-border text-[15px] font-bold text-text-main">Announcements sent</div>
      {err ? <div className="px-5 py-2 text-[12.5px] text-danger">{err}</div> : null}
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-text-faint">Nothing yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-table-head-bg">
                {["Title", "Importance", "To", "When", "Status", "Reached", "Read", ""].map((h) => (
                  <th key={h} className="text-left px-3.5 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3.5 py-2.5 text-[13px] font-semibold text-text-main border-b border-row-hover-border">{r.title}</td>
                  <td className="px-3.5 py-2.5 text-[12.5px] border-b border-row-hover-border whitespace-nowrap" style={{ color: r.level === "critical" ? "var(--danger)" : "var(--text-body)", fontWeight: 600 }}>
                    {r.level === "critical" ? "Critical" : "General"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border">{r.audience}</td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">{r.when}</td>
                  <td className="px-3.5 py-2.5 text-[12.5px] font-semibold border-b border-row-hover-border" style={{ color: STATUS[r.status]?.color }}>
                    {STATUS[r.status]?.label ?? r.status}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border">{r.status === "sent" ? r.recipients : "—"}</td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border">
                    {r.status === "sent" && r.recipients > 0 ? `${r.read} (${Math.round((r.read / r.recipients) * 100)}%)` : "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] border-b border-row-hover-border whitespace-nowrap">
                    {r.status === "scheduled" ? (
                      <button type="button" disabled={pending} onClick={() => act(() => cancelAnnouncement(r.id))} className="border-none bg-transparent text-danger font-semibold cursor-pointer disabled:opacity-60">
                        Cancel
                      </button>
                    ) : r.status === "sent" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirm("Remove this announcement from everyone's notifications?")) act(() => withdrawAnnouncement(r.id));
                        }}
                        className="border-none bg-transparent text-danger font-semibold cursor-pointer disabled:opacity-60"
                      >
                        Withdraw
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
