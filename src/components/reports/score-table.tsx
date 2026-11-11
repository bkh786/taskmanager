"use client";

import type { EmployeeScore } from "@/lib/task-score";
import { useColumnFilters, type FilterCol } from "@/components/table-filters";

const COLS: FilterCol<EmployeeScore>[] = [
  { key: "name", label: "Employee", value: (e) => e.name },
  { key: "code", label: "Emp code", value: (e) => e.employeeCode || "—" },
  { key: "designation", label: "Designation", value: (e) => e.designation || "—" },
  { key: "project", label: "Project", value: (e) => e.project || "—" },
  { key: "manager", label: "Reporting manager", value: (e) => e.manager || "—" },
  { key: "due", label: "Tasks due", value: (e) => String(e.due) },
  { key: "ontime", label: "Completed on time", value: (e) => String(e.onTime) },
  { key: "score", label: "Task score", value: (e) => `${Math.round(e.score * 100)}%` },
];

function scoreColor(score: number): string {
  if (score >= 0.8) return "var(--success)";
  if (score >= 0.5) return "oklch(0.5 0.15 70)";
  return "var(--danger)";
}

const td = "px-3.5 py-2.5 border-b border-row-hover-border whitespace-nowrap text-[13px] text-text-body";

/** Task performance score per employee, with a per-employee Excel download. */
export function ScoreTable({
  scores,
  applied,
  exportQuery,
}: {
  scores: EmployeeScore[];
  applied: boolean;
  /** The filters as a query string; the download adds the employee. */
  exportQuery: string;
}) {
  const cf = useColumnFilters(scores, COLS);
  const rows = cf.filtered;
  const due = rows.reduce((s, e) => s + e.due, 0);
  const onTime = rows.reduce((s, e) => s + e.onTime, 0);

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
      <div className="overflow-auto max-h-[calc(100dvh-330px)] min-h-[300px]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className="sticky top-0 z-10 bg-table-head-bg text-left px-3.5 py-2.5 text-[11px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {c.label}
                    {cf.headerButton(c.key)}
                  </span>
                </th>
              ))}
              <th className="sticky top-0 z-10 bg-table-head-bg border-b border-panel-border" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-[13px] text-text-faint">
                  {!applied
                    ? "Select the period above and click Apply to calculate scores."
                    : "No tasks fall in this period."}
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.assigneeId}>
                  <td className={`${td} font-semibold text-text-main`}>{e.name}</td>
                  <td className={td}>{e.employeeCode || "—"}</td>
                  <td className={td}>{e.designation || "—"}</td>
                  <td className={td}>{e.project || "—"}</td>
                  <td className={td}>{e.manager || "—"}</td>
                  <td className={td}>{e.due}</td>
                  <td className={td}>{e.onTime}</td>
                  <td className={`${td} font-bold`} style={{ color: scoreColor(e.score) }}>
                    {Math.round(e.score * 100)}%
                  </td>
                  <td className={`${td} text-right`}>
                    <a
                      href={`/api/score-export?${exportQuery}&assignee=${e.assigneeId}`}
                      className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs font-semibold"
                    >
                      ⬇ Score export
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-table-head-bg font-bold">
                <td className={td} colSpan={5}>
                  Overall ({rows.length} employee{rows.length === 1 ? "" : "s"})
                </td>
                <td className={td}>{due}</td>
                <td className={td}>{onTime}</td>
                <td className={td}>{due ? Math.round((onTime / due) * 100) : 0}%</td>
                <td className={td} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {cf.menu}
    </div>
  );
}
