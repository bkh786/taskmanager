"use client";

import { useState } from "react";
import Link from "next/link";
import type { TaskGroup } from "@/lib/dashboard-data";
import { BUCKET_META, bucketOf, fmtDate } from "@/lib/task-status";
import { useColumnFilters, type FilterCol } from "@/components/table-filters";
import { StatusBadge } from "./status-badge";
import { RecurrenceBadge } from "./recurrence-badge";

const COLS: (FilterCol<TaskGroup> & { header: string })[] = [
  { key: "task", header: "Task", label: "Task", value: (t) => t.taskName },
  {
    key: "recurrence",
    header: "Recurrence",
    label: "Recurrence",
    value: (t) => (t.isRecurring ? t.recurrenceKind.replace("_", " ") : "one time"),
  },
  { key: "assignee", header: "Assignee", label: "Assignee", value: (t) => t.assigneeName },
  { key: "project", header: "Project", label: "Project", value: (t) => t.projectName ?? "—" },
  { key: "due", header: "Due date", label: "Due date", value: (t) => fmtDate(t.representative.due_date) },
  {
    key: "status",
    header: "Status",
    label: "Status",
    value: (t) => BUCKET_META[bucketOf(t.representative)].label,
  },
];

const PAGE_SIZES = [10, 25, 50, 100];
type Filter = "all" | "delayed" | "pending";

/** Open work only (delayed + pending), shown a page at a time. */
export function TableView({ tasks }: { tasks: TaskGroup[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const cf = useColumnFilters(tasks, COLS, () => setPage(1));
  const isDelayed = (t: TaskGroup) => bucketOf(t.representative) === "delayed";
  const delayedCount = tasks.filter(isDelayed).length;
  const pendingCount = tasks.length - delayedCount;

  const visible = cf.filtered.filter((t) =>
    filter === "all" ? true : filter === "delayed" ? isDelayed(t) : !isDelayed(t)
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const rows = visible.slice(start, start + pageSize);

  const chip = (id: Filter, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        setFilter(id);
        setPage(1);
      }}
      className="border px-3 py-1 rounded-full text-[12.5px] font-semibold cursor-pointer"
      style={{
        borderColor: filter === id ? "var(--accent)" : "var(--panel-border)",
        background: filter === id ? "var(--accent-soft)" : "transparent",
        color: filter === id ? "var(--accent)" : "var(--text-body)",
      }}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border flex-wrap">
        {chip("all", "All open", tasks.length)}
        {chip("delayed", "Delayed", delayedCount)}
        {chip("pending", "Pending", pendingCount)}
        {cf.activeCount > 0 ? (
          <button
            type="button"
            onClick={cf.clearAll}
            className="text-[12px] text-accent font-semibold cursor-pointer bg-transparent border-none"
          >
            Clear column filters ({cf.activeCount})
          </button>
        ) : null}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-table-head-bg">
            {COLS.map((c) => (
              <th
                key={c.key}
                className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase tracking-wide border-b border-panel-border"
              >
                <span className="flex items-center gap-1.5">
                  {c.header}
                  {cf.headerButton(c.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-text-faint">
                No delayed or pending tasks.
              </td>
            </tr>
          ) : (
            rows.map((t) => (
              <tr key={t.taskId}>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <Link
                    href={`/tasks/${t.representative.id}`}
                    className="text-[13.5px] font-semibold text-text-main hover:text-accent"
                  >
                    {t.taskName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <RecurrenceBadge isRecurring={t.isRecurring} recurrenceKind={t.recurrenceKind} />
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {t.assigneeName}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {t.projectName ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {fmtDate(t.representative.due_date)}
                </td>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <StatusBadge instance={t.representative} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-2.5 text-[12.5px] text-text-sub flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>
            {visible.length === 0
              ? "Showing 0 of 0"
              : `Showing ${start + 1}–${start + rows.length} of ${visible.length}`}
          </span>
          <label className="flex items-center gap-1.5">
            Show:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-panel-border rounded-md px-2 py-1 bg-panel-bg text-text-main text-[12.5px]"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {current} of {totalPages}
          </span>
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            className="border border-panel-border bg-panel-bg rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={current >= totalPages}
            onClick={() => setPage(current + 1)}
            className="border border-panel-border bg-panel-bg rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
      {cf.menu}
    </div>
  );
}
