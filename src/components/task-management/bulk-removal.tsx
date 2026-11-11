"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { bulkRemoveInstances, type BulkRemoveState } from "@/app/(app)/task-management/actions";
import { REMOVAL_REASONS } from "@/lib/removal-reasons";
import { useColumnFilters, type FilterCol } from "@/components/table-filters";
import { fmtDate } from "@/lib/task-status";

export type RemovalRow = {
  id: string;
  taskName: string;
  assigneeName: string;
  assigneeActive: boolean;
  project: string;
  dueDate: string;
  kind: "Overdue" | "Due";
  recurring: string;
};

const COLS: FilterCol<RemovalRow>[] = [
  { key: "task", label: "Task", value: (r) => r.taskName },
  { key: "assignee", label: "Assignee", value: (r) => r.assigneeName },
  { key: "project", label: "Project", value: (r) => r.project },
  { key: "due", label: "Due date", value: (r) => fmtDate(r.dueDate) },
  { key: "kind", label: "Status", value: (r) => r.kind },
  { key: "recurring", label: "Schedule", value: (r) => r.recurring },
];

const PAGE_SIZES = [10, 25, 50, 100];
const initial: BulkRemoveState = { error: null, removed: 0, skipped: 0 };
const select = "px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg";

/**
 * Bulk removal of due and overdue tasks. Step 1: choose people and tick tasks.
 * Step 2 (same page): a reason is required before anything is removed.
 */
export function BulkRemoval({
  rows,
  employees,
  projects,
  emp,
  proj,
  truncated,
}: {
  rows: RemovalRow[];
  employees: { id: string; full_name: string; is_active: boolean }[];
  projects: { id: string; name: string }[];
  emp: string;
  proj: string;
  truncated: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [step, setStep] = useState<"select" | "reason">("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<BulkRemoveState>(initial);
  const [pending, startRemove] = useTransition();
  const [reasonCode, setReasonCode] = useState("");

  const cf = useColumnFilters(rows, COLS, () => setPage(1));
  const visible = cf.filtered;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = visible.slice((current - 1) * pageSize, current * pageSize);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    p.set("tab", "remove");
    if (value) p.set(key, value);
    else p.delete(key);
    if (key === "emp") p.delete("proj");
    if (key === "proj") p.delete("emp");
    router.push(`${pathname}?${p.toString()}`);
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  }

  // Runs the removal; on success the list refreshes and the selection resets.
  function submitRemoval(fd: FormData) {
    startRemove(async () => {
      const res = await bulkRemoveInstances(initial, fd);
      setState(res);
      if (!res.error && res.removed > 0) {
        setSelected(new Set());
        setStep("select");
        setReasonCode("");
        router.refresh();
      }
    });
  }

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  // ------------------------------------------------------------- step 2: reason
  if (step === "reason") {
    return (
      <form action={submitRemoval} className="bg-panel-bg border border-panel-border rounded-xl px-6 py-5 flex flex-col gap-4">
        <div>
          <div className="text-[16px] font-bold text-text-main">Remove {chosen.length} task{chosen.length === 1 ? "" : "s"}</div>
          <div className="text-[12.5px] text-text-sub mt-1">
            Removed tasks disappear from dashboards and reports and cannot be restored from the portal. A reason is required.
          </div>
        </div>
        {chosen.map((r) => (
          <input key={r.id} type="hidden" name="instanceIds" value={r.id} />
        ))}
        <div className="max-h-[200px] overflow-y-auto border border-panel-border rounded-md">
          {chosen.slice(0, 50).map((r) => (
            <div key={r.id} className="flex justify-between gap-3 px-3 py-1.5 text-[12.5px] border-b border-row-hover-border last:border-b-0">
              <span className="text-text-main truncate">{r.taskName}</span>
              <span className="text-text-sub whitespace-nowrap">
                {r.assigneeName} · {fmtDate(r.dueDate)}
              </span>
            </div>
          ))}
          {chosen.length > 50 ? (
            <div className="px-3 py-1.5 text-[12px] text-text-faint">…and {chosen.length - 50} more</div>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-semibold text-text-sub block mb-1.5">Reason *</label>
          <select
            name="reasonCode"
            required
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className={`${select} w-full max-w-[360px]`}
          >
            <option value="" disabled>
              Select a reason…
            </option>
            {REMOVAL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-sub block mb-1.5">Describe the reason *</label>
          <textarea
            name="reasonDetail"
            required
            minLength={3}
            rows={3}
            placeholder="Add the details behind this removal"
            className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main resize-y"
          />
        </div>
        {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setStep("select")}
            className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] cursor-pointer"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={pending}
            className="border-none bg-danger text-white px-4.5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
          >
            {pending ? "Removing…" : `Confirm removal of ${chosen.length}`}
          </button>
        </div>
      </form>
    );
  }

  // ------------------------------------------------------------- step 1: select
  return (
    <div>
      {state.removed > 0 && !state.error ? (
        <div className="text-[12.5px] text-success mb-3">
          Removed {state.removed} task{state.removed === 1 ? "" : "s"}
          {state.skipped > 0 ? ` (${state.skipped} skipped)` : ""}.
        </div>
      ) : null}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-text-sub">
          Employee
          <select value={emp} onChange={(e) => setParam("emp", e.target.value)} className={select}>
            <option value="">Choose…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} style={e.is_active ? undefined : { color: "var(--text-faint)" }}>
                {e.full_name}
                {e.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[12px] text-text-faint">or</span>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-text-sub">
          Project
          <select value={proj} onChange={(e) => setParam("proj", e.target.value)} className={select}>
            <option value="">Choose…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!emp && !proj ? (
        <div className="text-[13px] text-text-faint">
          Choose an employee or a project to list their due and overdue tasks.
        </div>
      ) : (
        <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-panel-border flex-wrap">
            <div className="text-[13px] text-text-sub">
              {selected.size} selected · {visible.length} listed
              {truncated ? " (first 1,500 shown, narrow the selection to see the rest)" : ""}
              {cf.activeCount > 0 ? (
                <button type="button" onClick={cf.clearAll} className="ml-3 text-accent font-semibold bg-transparent border-none cursor-pointer text-[12px]">
                  Clear column filters
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setStep("reason")}
              className="border-none bg-danger text-white px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-50"
            >
              Remove selected ({selected.size})
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-table-head-bg">
                  <th className="px-4 py-2.5 border-b border-panel-border w-[36px]">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all listed tasks" />
                  </th>
                  {COLS.map((c) => (
                    <th key={c.key} className="text-left px-3.5 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {c.label}
                        {cf.headerButton(c.key)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length + 1} className="px-4 py-8 text-center text-[13px] text-text-faint">
                      No due or overdue tasks found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} className={r.assigneeActive ? undefined : "tm-inactive"}>
                      <td className="px-4 py-2.5 border-b border-row-hover-border">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${r.taskName}`}
                        />
                      </td>
                      <td className="px-3.5 py-2.5 text-[13px] font-semibold text-text-main border-b border-row-hover-border">{r.taskName}</td>
                      <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">{r.assigneeName}</td>
                      <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">{r.project}</td>
                      <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                      <td className="px-3.5 py-2.5 text-[12.5px] border-b border-row-hover-border whitespace-nowrap">
                        <span style={{ color: r.kind === "Overdue" ? "var(--kpi-red)" : "var(--kpi-blue)", fontWeight: 600 }}>{r.kind}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">{r.recurring}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[12.5px] text-text-sub flex-wrap gap-2 border-t border-panel-border">
            <label className="flex items-center gap-1.5">
              Show:
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className={select}>
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span>Page {current} of {totalPages}</span>
              <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="border border-panel-border bg-panel-bg rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-40">‹</button>
              <button type="button" disabled={current >= totalPages} onClick={() => setPage(current + 1)} className="border border-panel-border bg-panel-bg rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-40">›</button>
            </div>
          </div>
        </div>
      )}
      {cf.menu}
    </div>
  );
}
