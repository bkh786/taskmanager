"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function OrgFilterControls({
  filterMode,
  filterValue,
  projects,
  employees,
  designations,
}: {
  filterMode: string;
  filterValue: string;
  projects: { id: string; name: string }[];
  employees: { id: string; full_name: string; is_active?: boolean }[];
  designations: { id: string; name: string }[];
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
        <option value="designation">By designation</option>
      </select>
      {filterMode === "employee" ? (
        <select
          value={filterValue}
          onChange={(e) => setParam("filterValue", e.target.value)}
          className="px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg"
        >
          <option value="">Choose employee…</option>
          {employees.map((e) => (
            <option
              key={e.id}
              value={e.id}
              style={e.is_active === false ? { color: "var(--text-faint)" } : undefined}
            >
              {e.full_name}
              {e.is_active === false ? " (inactive)" : ""}
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
      {filterMode === "designation" ? (
        <select
          value={filterValue}
          onChange={(e) => setParam("filterValue", e.target.value)}
          className="px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg"
        >
          <option value="">Choose designation…</option>
          {designations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
