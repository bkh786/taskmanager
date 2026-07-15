import Link from "next/link";
import type { BreakdownMode } from "@/lib/dashboard-data";

export function BreakdownPanel({
  rows,
  mode,
  buildHref,
}: {
  rows: { label: string; total: number; completed: number; delayed: number; completedPct: number }[];
  mode: BreakdownMode;
  buildHref: (mode: BreakdownMode) => string;
}) {
  const tabs: { id: BreakdownMode; label: string }[] = [
    { id: "project", label: "Project" },
    { id: "employee", label: "Employee" },
    { id: "role", label: "Role" },
  ];

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] px-5 py-4.5 mb-5.5">
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[14.5px] font-bold text-text-main">Breakdown</div>
        <div className="flex bg-chip-bg rounded-lg p-[3px] gap-0.5">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={buildHref(t.id)}
              className="border-none px-3 py-1.5 rounded-md text-[12.5px] font-semibold whitespace-nowrap"
              style={{
                background: mode === t.id ? "var(--panel-bg)" : "transparent",
                color: mode === t.id ? "var(--accent)" : "var(--text-body)",
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-[13px] text-text-faint">No tasks yet.</div>
      ) : (
        rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3.5 py-2.5 border-b border-row-hover-border last:border-b-0"
          >
            <div className="w-[150px] shrink-0 text-[13px] font-semibold text-text-main truncate">
              {r.label}
            </div>
            <div className="flex-1 h-2 bg-table-head-bg rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{ background: "oklch(0.45 0.13 145)", width: `${r.completedPct}%` }}
              />
            </div>
            <div className="w-[38px] shrink-0 text-right text-[12px] text-text-sub">
              {r.completedPct}%
            </div>
            <div className="flex gap-2.5 shrink-0 w-[170px] justify-end text-[11.5px] text-text-sub">
              {r.delayed ? (
                <span className="text-danger font-semibold">{r.delayed} delayed</span>
              ) : null}
              <span>{r.total} total</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
