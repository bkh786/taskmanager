"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Employee } from "@/lib/org-data";

const VIEWS = [
  { id: "table", label: "Table" },
  { id: "kanban", label: "Kanban" },
  { id: "calendar", label: "Calendar" },
] as const;

export function ViewTabs({ view }: { view: string }) {
  const params = useSearchParams();

  function hrefFor(v: string) {
    const p = new URLSearchParams(params.toString());
    p.set("view", v);
    return `?${p.toString()}`;
  }

  return (
    <div className="flex bg-chip-bg rounded-lg p-[3px] gap-0.5">
      {VIEWS.map((v) => (
        <Link
          key={v.id}
          href={hrefFor(v.id)}
          className="border-none px-3.5 py-1.5 rounded-md text-[13px] font-semibold"
          style={{
            background: view === v.id ? "var(--panel-bg)" : "transparent",
            color: view === v.id ? "var(--accent)" : "var(--text-body)",
          }}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

export function FilterControls({
  filterMode,
  filterValue,
  employees,
  projects,
}: {
  filterMode: string;
  filterValue: string;
  employees: Employee[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    if (key === "filterMode") p.delete("filterValue");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={filterMode}
        onChange={(e) => setParam("filterMode", e.target.value)}
        className="px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg"
      >
        <option value="all">All tasks</option>
        <option value="employee">By employee</option>
        <option value="project">By project</option>
      </select>
      {filterMode === "employee" ? (
        <select
          value={filterValue}
          onChange={(e) => setParam("filterValue", e.target.value)}
          className="px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg"
        >
          <option value="">Choose employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
      ) : null}
      {filterMode === "project" ? (
        <select
          value={filterValue}
          onChange={(e) => setParam("filterValue", e.target.value)}
          className="px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg"
        >
          <option value="">Choose project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
