"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { todayIso } from "@/lib/task-status";
import type { ReportOptions } from "@/lib/report-options";

const ROLE_LABELS: Record<string, string> = {
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};
const STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "delayed", label: "Delayed" },
];

function lastMonths(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const today = new Date(todayIso() + "T00:00:00");
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) });
  }
  return out;
}

type Opt = { value: string; label: string };

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Opt[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer whitespace-nowrap"
      >
        {label} {selected.length > 0 ? `(${selected.length})` : "(all)"}
      </button>
      {open ? (
        <div className="absolute z-20 top-full mt-1.5 left-0 min-w-[200px] max-w-[280px] max-h-[260px] overflow-y-auto bg-panel-bg border border-panel-border rounded-md shadow-lg p-2">
          {options.length === 0 ? (
            <div className="text-[12px] text-text-faint px-1.5 py-1">No options for this selection</div>
          ) : (
            options.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 text-[12.5px] text-text-body px-1.5 py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() =>
                    onChange(
                      selected.includes(o.value)
                        ? selected.filter((v) => v !== o.value)
                        : [...selected, o.value]
                    )
                  }
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11.5px] text-accent font-semibold mt-1 px-1.5 cursor-pointer"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type AppliedFilters = {
  dateFrom: string;
  dateTo: string;
  months: string[];
  projects: string[];
  designations: string[];
  roles: string[];
  statuses: string[];
  assignedBy: string[];
};

type Sel = Pick<AppliedFilters, "projects" | "designations" | "roles" | "assignedBy">;

/** Each filter's choices are limited to what exists given the OTHER filters,
 * so any combination that can be picked is one that can return data. */
function computeOptions(options: ReportOptions, f: Sel) {
  const linksByAssignee = new Map<string, Set<string>>();
  for (const [assigner, assignee] of options.links) {
    if (!linksByAssignee.has(assignee)) linksByAssignee.set(assignee, new Set());
    linksByAssignee.get(assignee)!.add(assigner);
  }
  const inSet = (sel: string[], v: string | null) => sel.length === 0 || (!!v && sel.includes(v));
  const byAssigner = (id: string) =>
    f.assignedBy.length === 0 ||
    [...(linksByAssignee.get(id) ?? [])].some((a) => f.assignedBy.includes(a));
  const match = (skip: "p" | "d" | "r") =>
    options.people.filter(
      (p) =>
        (skip === "p" || inSet(f.projects, p.projectId)) &&
        (skip === "d" || inSet(f.designations, p.designationId)) &&
        (skip === "r" || inSet(f.roles, p.role)) &&
        byAssigner(p.id)
    );

  const projIds = new Set(match("p").map((p) => p.projectId));
  const desIds = new Set(match("d").map((p) => p.designationId));
  const roleIds = new Set(match("r").map((p) => p.role));
  const assigneeIds = new Set(
    options.people
      .filter(
        (p) =>
          inSet(f.projects, p.projectId) &&
          inSet(f.designations, p.designationId) &&
          inSet(f.roles, p.role)
      )
      .map((p) => p.id)
  );
  const assignerSet = new Set<string>();
  for (const [assigner, assignee] of options.links) {
    if (assigneeIds.has(assignee)) assignerSet.add(assigner);
  }
  return {
    projectOpts: options.projects
      .filter((p) => projIds.has(p.id))
      .map((p) => ({ value: p.id, label: p.name })),
    designationOpts: options.designations
      .filter((d) => desIds.has(d.id))
      .map((d) => ({ value: d.id, label: d.name })),
    roleOpts: Object.keys(ROLE_LABELS)
      .filter((r) => roleIds.has(r as never))
      .map((r) => ({ value: r, label: ROLE_LABELS[r] })),
    assignerOpts: options.assigners
      .filter((a) => assignerSet.has(a.id))
      .map((a) => ({ value: a.id, label: a.name })),
  };
}

export function ReportFilters({
  options,
  initial,
  applied,
  defaultFrom,
  defaultTo,
}: {
  options: ReportOptions;
  initial: AppliedFilters;
  applied: boolean;
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState<AppliedFilters>(initial);
  const monthOptions = lastMonths(12);
  const set = <K extends keyof AppliedFilters>(k: K, v: AppliedFilters[K]) =>
    setF((p) => {
      let next = { ...p, [k]: v };
      // Drop selections the other filters have made impossible (settles in a few passes).
      for (let i = 0; i < 4; i++) {
        const o = computeOptions(options, next);
        const keep = (sel: string[], opts: Opt[]) =>
          sel.filter((x) => opts.some((y) => y.value === x));
        const pruned = {
          ...next,
          projects: keep(next.projects, o.projectOpts),
          designations: keep(next.designations, o.designationOpts),
          roles: keep(next.roles, o.roleOpts),
          assignedBy: keep(next.assignedBy, o.assignerOpts),
        };
        const same =
          pruned.projects.length === next.projects.length &&
          pruned.designations.length === next.designations.length &&
          pruned.roles.length === next.roles.length &&
          pruned.assignedBy.length === next.assignedBy.length;
        next = pruned;
        if (same) break;
      }
      return next;
    });

  const { projectOpts, designationOpts, roleOpts, assignerOpts } = computeOptions(options, f);

  function apply() {
    const p = new URLSearchParams();
    p.set("applied", "1");
    if (f.months.length === 0) {
      if (f.dateFrom) p.set("dateFrom", f.dateFrom);
      if (f.dateTo) p.set("dateTo", f.dateTo);
    }
    const lists: [string, string[]][] = [
      ["months", f.months],
      ["projects", f.projects],
      ["designations", f.designations],
      ["roles", f.roles],
      ["statuses", f.statuses],
      ["assignedBy", f.assignedBy],
    ];
    for (const [k, v] of lists) if (v.length > 0) p.set(k, v.join(","));
    router.push(`${pathname}?${p.toString()}`);
  }

  function reset() {
    setF({
      dateFrom: defaultFrom,
      dateTo: defaultTo,
      months: [],
      projects: [],
      designations: [],
      roles: [],
      statuses: [],
      assignedBy: [],
    });
    router.push(pathname);
  }

  const monthsChosen = f.months.length > 0;
  const dateInput = "px-2 py-1.5 border border-panel-border rounded-md text-[12.5px] text-text-main bg-panel-bg disabled:opacity-50";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-semibold text-text-sub">Due date from</label>
        <input
          type="date"
          value={f.dateFrom}
          max={todayIso()}
          disabled={monthsChosen}
          onChange={(e) => set("dateFrom", e.target.value)}
          className={dateInput}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-semibold text-text-sub">to</label>
        <input
          type="date"
          value={f.dateTo}
          max={todayIso()}
          disabled={monthsChosen}
          onChange={(e) => set("dateTo", e.target.value)}
          className={dateInput}
        />
      </div>
      <MultiSelect label="Months" options={monthOptions} selected={f.months} onChange={(v) => set("months", v)} />
      <MultiSelect label="Projects" options={projectOpts} selected={f.projects} onChange={(v) => set("projects", v)} />
      <MultiSelect label="Designations" options={designationOpts} selected={f.designations} onChange={(v) => set("designations", v)} />
      <MultiSelect label="Roles" options={roleOpts} selected={f.roles} onChange={(v) => set("roles", v)} />
      <MultiSelect label="Task status" options={STATUS_OPTIONS} selected={f.statuses} onChange={(v) => set("statuses", v)} />
      <MultiSelect label="Assigned by" options={assignerOpts} selected={f.assignedBy} onChange={(v) => set("assignedBy", v)} />

      <button
        type="button"
        onClick={apply}
        className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer"
      >
        Apply
      </button>
      {applied || monthsChosen || f.projects.length + f.designations.length + f.roles.length + f.statuses.length + f.assignedBy.length > 0 ? (
        <button type="button" onClick={reset} className="text-[12px] text-text-faint underline cursor-pointer">
          Reset
        </button>
      ) : null}
      {monthsChosen ? (
        <span className="text-[11.5px] text-text-faint">Months override the due-date range.</span>
      ) : null}
    </div>
  );
}
