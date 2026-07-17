"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "reporting_manager", label: "Reporting Manager" },
  { value: "user", label: "Employee" },
];

export function OrgFilterControls({
  filterMode,
  filterValue,
  projects,
}: {
  filterMode: string;
  filterValue: string;
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
        <option value="project">By project</option>
        <option value="role">By role</option>
      </select>
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
      {filterMode === "role" ? (
        <select
          value={filterValue}
          onChange={(e) => setParam("filterValue", e.target.value)}
          className="px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg"
        >
          <option value="">Choose role…</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
