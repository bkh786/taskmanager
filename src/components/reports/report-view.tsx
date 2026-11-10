"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReportRow } from "@/lib/report-data";
import { fmtDate } from "@/lib/task-status";
import { ExportButton } from "./export-button";

type Col = {
  key: string;
  label: string;
  value: (r: ReportRow) => string;
  render?: (r: ReportRow) => ReactNode;
};

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Report results in a fixed window: the header row stays put, only the rows
 * scroll, results are paged, and every column header filters within the
 * loaded data. The download exports whatever the header filters leave.
 */
export function ReportView({
  heading,
  filters,
  rows,
  attachmentUrls,
  appUrl,
  showOrganization = false,
  applied,
}: {
  heading: ReactNode;
  filters: ReactNode;
  rows: ReportRow[];
  attachmentUrls: Record<string, string>;
  appUrl: string;
  showOrganization?: boolean;
  applied: boolean;
}) {
  const cols: Col[] = useMemo(
    () => [
      ...(showOrganization
        ? [{ key: "org", label: "Organization", value: (r: ReportRow) => r.organization || "—" }]
        : []),
      { key: "task", label: "Task Name", value: (r) => r.taskName },
      { key: "assigned", label: "Assigned", value: (r) => fmtDate(r.assignedDate) },
      { key: "due", label: "Due", value: (r) => fmtDate(r.dueDate) },
      { key: "cdate", label: "Completed Date", value: (r) => (r.completedDate ? fmtDate(r.completedDate) : "—") },
      { key: "ctime", label: "Completed Time", value: (r) => r.completedTime || "—" },
      { key: "delay", label: "Delay (d)", value: (r) => String(r.delayInDays) },
      { key: "status", label: "Status", value: (r) => r.status },
      { key: "assignee", label: "Assignee", value: (r) => r.assigneeName },
      { key: "designation", label: "Designation", value: (r) => r.designation || "—" },
      { key: "project", label: "Project", value: (r) => r.project || "—" },
      {
        key: "doc",
        label: "Supporting Document",
        value: (r) => (r.evidencePath && attachmentUrls[r.instanceId] ? "Available" : "—"),
        render: (r) =>
          r.evidencePath && attachmentUrls[r.instanceId] ? (
            <a
              href={attachmentUrls[r.instanceId]}
              target="_blank"
              rel="noreferrer"
              className="text-accent font-semibold"
            >
              Preview →
            </a>
          ) : (
            <span className="text-text-faint">—</span>
          ),
      },
    ],
    [showOrganization, attachmentUrls]
  );

  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ key: string; top: number; left: number } | null>(null);
  const [menuSearch, setMenuSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // A fresh result set (new Apply) starts clean.
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setColFilters({});
    setSearch("");
    setPage(1);
    setMenu(null);
  }

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const q = search.trim().toLowerCase();
  const passes = (r: ReportRow, skipKey?: string) => {
    for (const c of cols) {
      if (c.key === skipKey) continue;
      const sel = colFilters[c.key];
      if (sel && sel.length > 0 && !sel.includes(c.value(r))) return false;
    }
    return true;
  };
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          passes(r) &&
          (!q || cols.some((c) => c.value(r).toLowerCase().includes(q)))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, colFilters, q, cols]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  // Options for the open column: values that exist given the OTHER header filters.
  const menuOptions = useMemo(() => {
    if (!menu) return [];
    const col = cols.find((c) => c.key === menu.key)!;
    const set = new Set<string>();
    for (const r of rows) if (passes(r, menu.key)) set.add(col.value(r));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, rows, colFilters, cols]);

  function toggleValue(key: string, v: string) {
    setColFilters((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
    setPage(1);
  }

  const activeFilters = Object.entries(colFilters).filter(([, v]) => v.length > 0);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-200px)] lg:min-h-[420px]">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3 shrink-0">
        {heading}
        <ExportButton rows={filtered} appUrl={appUrl} showOrganization={showOrganization} />
      </div>
      <div className="mb-4 shrink-0">{filters}</div>

      <div className="flex-1 min-h-[460px] lg:min-h-0 flex flex-col bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-panel-border shrink-0 flex-wrap">
          <input
            type="text"
            value={search}
            disabled={!applied}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search within results…"
            className="w-full max-w-[320px] px-3 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main disabled:opacity-50"
          />
          {activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setColFilters({});
                setPage(1);
              }}
              className="text-[12px] text-accent font-semibold cursor-pointer"
            >
              Clear column filters ({activeFilters.length})
            </button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {cols.map((c) => {
                  const active = (colFilters[c.key]?.length ?? 0) > 0;
                  return (
                    <th
                      key={c.key}
                      className="sticky top-0 z-10 bg-table-head-bg text-left px-3.5 py-2.5 text-[11px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {c.label}
                        <button
                          type="button"
                          disabled={!applied || rows.length === 0}
                          title={`Filter ${c.label}`}
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMenuSearch("");
                            setMenu(
                              menu?.key === c.key
                                ? null
                                : {
                                    key: c.key,
                                    top: rect.bottom + 6,
                                    left: Math.min(rect.left, window.innerWidth - 270),
                                  }
                            );
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] border-none cursor-pointer disabled:opacity-40 ${
                            active ? "bg-accent text-white" : "bg-transparent text-text-faint hover:text-accent"
                          }`}
                        >
                          ▼
                        </button>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-10 text-center text-[13px] text-text-faint">
                    {!applied
                      ? "Select your filters above and click Apply to load the report."
                      : "No task instances match these filters."}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.instanceId}>
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3.5 py-2.5 text-[12.5px] border-b border-row-hover-border whitespace-nowrap ${
                          c.key === "task" ? "font-semibold text-text-main text-[13px]" : "text-text-body"
                        } ${c.key === "status" ? "capitalize" : ""}`}
                      >
                        {c.render ? c.render(r) : c.value(r)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-panel-border shrink-0 text-[12.5px] text-text-sub flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>
              {filtered.length === 0
                ? "Showing 0 of 0"
                : `Showing ${start + 1}–${start + pageRows.length} of ${filtered.length}`}
              {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
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
      </div>

      {menu ? (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menu.top, left: menu.left }}
          className="z-50 w-[260px] bg-panel-bg border border-panel-border rounded-md shadow-lg p-2"
        >
          <input
            autoFocus
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Search values…"
            className="w-full px-2 py-1.5 mb-1.5 border border-panel-border rounded-md text-[12.5px] bg-panel-bg text-text-main"
          />
          <div className="max-h-[240px] overflow-y-auto">
            {menuOptions
              .filter((v) => v.toLowerCase().includes(menuSearch.trim().toLowerCase()))
              .slice(0, 300)
              .map((v) => (
                <label key={v} className="flex items-center gap-2 text-[12.5px] text-text-body px-1.5 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(colFilters[menu.key] ?? []).includes(v)}
                    onChange={() => toggleValue(menu.key, v)}
                  />
                  <span className="truncate">{v}</span>
                </label>
              ))}
            {menuOptions.length === 0 ? (
              <div className="text-[12px] text-text-faint px-1.5 py-1">No values</div>
            ) : null}
          </div>
          {(colFilters[menu.key]?.length ?? 0) > 0 ? (
            <button
              type="button"
              onClick={() => {
                setColFilters((p) => ({ ...p, [menu.key]: [] }));
                setPage(1);
              }}
              className="text-[11.5px] text-accent font-semibold mt-1.5 px-1.5 cursor-pointer"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
