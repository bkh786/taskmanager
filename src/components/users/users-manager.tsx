"use client";

import { useEffect, useMemo, useState } from "react";
import type { Employee, DesignationItem } from "@/lib/org-data";
import type { AppUser } from "@/lib/auth";
import { UserModal } from "./user-modal";
import { EditUserModal } from "./edit-user-modal";
import { ProjectsDesignationsPanel } from "./projects-designations-panel";
import { ExportUsersButton } from "./export-users-button";
import { useColumnFilters, type FilterCol } from "@/components/table-filters";
import { BulkUsersUploadForm } from "@/components/bulk-upload-users/upload-form";

type ModalState = { kind: "none" } | { kind: "add" } | { kind: "replace" | "edit"; target: Employee };

type SortKey =
  | "full_name"
  | "employee_code"
  | "email"
  | "project"
  | "designation"
  | "manager";
type SortDir = "asc" | "desc";

const dash = (v: string | null | undefined) => v || "—";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "full_name", label: "Name" },
  { key: "employee_code", label: "Employee Code" },
  { key: "email", label: "Email" },
  { key: "project", label: "Project" },
  { key: "designation", label: "Designation" },
  { key: "manager", label: "Reporting Manager" },
];

function sortValue(u: Employee, key: SortKey): string {
  switch (key) {
    case "full_name":
      return u.full_name;
    case "employee_code":
      return u.employee_code;
    case "email":
      return u.email;
    case "project":
      return u.project_name ?? "";
    case "designation":
      return u.designation_name ?? "";
    case "manager":
      return u.manager_name ?? "";
  }
}

/** Debounces a fast-changing value so expensive work (filtering) doesn't
 * re-run on every keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function UsersManager({
  users,
  managers,
  projects,
  designations,
  allowedRoles,
  showReportsTo,
  canCreate = true,
  orgId,
  bulkOrgs = [],
  showProjectsPanel = false,
}: {
  users: Employee[];
  managers: Employee[];
  projects: { id: string; name: string }[];
  designations: DesignationItem[];
  allowedRoles: AppUser["system_role"][];
  showReportsTo: boolean;
  /** Whether this viewer can create/replace users and add projects/designations. */
  canCreate?: boolean;
  /** Set only when a platform_owner is managing a tenant other than their own. */
  orgId?: string;
  /** Organizations the bulk-upload window can target (the viewer's own, or the tenant being managed). */
  bulkOrgs?: { id: string; slug: string; name: string }[];
  /** Projects/designations now live under Organization Settings; only the platform owner's tenant page still shows them here. */
  showProjectsPanel?: boolean;
}) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filterCols: FilterCol<Employee>[] = COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    value: (u) => dash(sortValue(u, c.key)),
  }));
  const colFilters = useColumnFilters(users, filterCols);

  const visibleUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = q
      ? colFilters.filtered.filter((u) =>
          [
            u.full_name,
            u.employee_code,
            u.email,
            u.project_name ?? "",
            u.designation_name ?? "",
            u.manager_name ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : colFilters.filtered;

    const sorted = [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), undefined, {
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [colFilters.filtered, debouncedSearch, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-[22px] font-bold text-text-main">User Management</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Manage employees across your tenant
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportUsersButton users={users} />
          {canCreate && bulkOrgs.length > 0 ? (
            <button
              onClick={() => setBulkOpen(true)}
              className="border border-panel-border bg-panel-bg text-text-body hover:border-accent px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap"
            >
              ⬆ Bulk Upload
            </button>
          ) : null}
          {canCreate ? (
            <button
              onClick={() => setModal({ kind: "add" })}
              className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap"
            >
              + Add User
            </button>
          ) : null}
        </div>
      </div>

      {showProjectsPanel ? (
        <ProjectsDesignationsPanel
          projects={projects}
          designations={designations}
          canCreate={canCreate}
          orgId={orgId}
        />
      ) : null}

      <div className="mb-3.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, email, project, designation or manager…"
          className="w-full max-w-[420px] px-3 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border"
                >
                  <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="flex items-center gap-1 border-none bg-transparent p-0 font-bold text-[11.5px] uppercase text-text-sub cursor-pointer"
                  >
                    {c.label}
                    <span className="text-text-faint">
                      {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                  {colFilters.headerButton(c.key)}
                  </span>
                </th>
              ))}
              <th className="sticky right-0 bg-table-head-bg px-4 py-2.5 border-b border-panel-border" />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  {users.length === 0 ? "No users yet." : "No users match your search."}
                </td>
              </tr>
            ) : (
              visibleUsers.map((u) => (
                <tr key={u.id} className={u.is_active ? undefined : "tm-inactive"}>
                  <td className="px-4 py-2.5 text-[13.5px] font-semibold text-text-main border-b border-row-hover-border">
                    {u.full_name}
                    {!u.is_active ? (
                      <span className="ml-2 text-[11px] font-normal text-text-faint">
                        (inactive)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.employee_code}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.email}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.project_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.designation_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.manager_name ?? "—"}
                  </td>
                  <td className="sticky right-0 bg-panel-bg px-4 py-2.5 border-b border-row-hover-border text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setModal({ kind: "edit", target: u })}
                        className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer whitespace-nowrap"
                      >
                        Edit
                      </button>
                      {canCreate ? (
                        <button
                          onClick={() => setModal({ kind: "replace", target: u })}
                          className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer whitespace-nowrap"
                        >
                          Replace
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {bulkOpen ? (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBulkOpen(false);
          }}
        >
          <div className="w-[680px] max-w-full max-h-[88vh] overflow-y-auto bg-body-bg rounded-xl px-6 py-5 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[16px] font-bold text-text-main">Bulk Upload Users</div>
                <div className="text-[13px] text-text-sub">
                  Download the template, fill it in, and upload it to create many users at once.
                </div>
              </div>
              <button
                onClick={() => setBulkOpen(false)}
                aria-label="Close"
                className="border-none bg-transparent text-text-faint text-[20px] leading-none cursor-pointer px-1"
              >
                ×
              </button>
            </div>
            <BulkUsersUploadForm orgs={bulkOrgs} />
          </div>
        </div>
      ) : null}

      {colFilters.menu}

      {modal.kind === "add" || modal.kind === "replace" ? (
        <UserModal
          employees={users}
          managers={managers}
          projects={projects}
          designations={designations}
          allowedRoles={allowedRoles}
          showReportsTo={showReportsTo}
          presetTarget={modal.kind === "replace" ? modal.target : null}
          orgId={orgId}
          onClose={() => setModal({ kind: "none" })}
        />
      ) : null}

      {modal.kind === "edit" ? (
        <EditUserModal
          target={modal.target}
          projects={projects}
          designations={designations}
          managers={managers}
          employees={users}
          canEditRole={showReportsTo}
          allowedRoles={allowedRoles}
          orgId={orgId}
          onClose={() => setModal({ kind: "none" })}
        />
      ) : null}
    </div>
  );
}
