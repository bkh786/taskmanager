"use client";

import { useEffect, useMemo, useState } from "react";
import type { Employee } from "@/lib/org-data";
import type { AppUser } from "@/lib/auth";
import { UserModal } from "./user-modal";
import { EditUserModal } from "./edit-user-modal";
import { ProjectsDesignationsPanel } from "./projects-designations-panel";
import { ExportUsersButton } from "./export-users-button";

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

type ModalState = { kind: "none" } | { kind: "add" } | { kind: "replace" | "edit"; target: Employee };

type SortKey = "full_name" | "employee_code" | "email" | "role" | "project";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "full_name", label: "Name" },
  { key: "employee_code", label: "Employee Code" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "project", label: "Project" },
];

function sortValue(u: Employee, key: SortKey): string {
  switch (key) {
    case "full_name":
      return u.full_name;
    case "employee_code":
      return u.employee_code;
    case "email":
      return u.email;
    case "role":
      return ROLE_LABELS[u.system_role];
    case "project":
      return u.project_name ?? "";
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
}: {
  users: Employee[];
  managers: Employee[];
  projects: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  allowedRoles: AppUser["system_role"][];
  showReportsTo: boolean;
  /** Whether this viewer can create/replace users and add projects/designations. */
  canCreate?: boolean;
  /** Set only when a platform_owner is managing a tenant other than their own. */
  orgId?: string;
}) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const visibleUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) =>
          [u.full_name, u.employee_code, u.email, ROLE_LABELS[u.system_role], u.project_name ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : users;

    const sorted = [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), undefined, {
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [users, debouncedSearch, sortKey, sortDir]);

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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[22px] font-bold text-text-main">User Management</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Manage employees across your tenant
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportUsersButton users={users} />
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

      <ProjectsDesignationsPanel
        projects={projects}
        designations={designations}
        canCreate={canCreate}
        orgId={orgId}
      />

      <div className="mb-3.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, employee code, email, role, or project…"
          className="w-full max-w-[420px] px-3 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border"
                >
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
                </th>
              ))}
              <th className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border" />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  {users.length === 0 ? "No users yet." : "No users match your search."}
                </td>
              </tr>
            ) : (
              visibleUsers.map((u) => (
                <tr key={u.id}>
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
                    {ROLE_LABELS[u.system_role]}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.project_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 border-b border-row-hover-border text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setModal({ kind: "edit", target: u })}
                        className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer"
                      >
                        Edit
                      </button>
                      {canCreate ? (
                        <button
                          onClick={() => setModal({ kind: "replace", target: u })}
                          className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer"
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

      {modal.kind === "add" || modal.kind === "replace" ? (
        <UserModal
          employees={users}
          managers={managers}
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
          canEditRole={showReportsTo}
          allowedRoles={allowedRoles}
          orgId={orgId}
          onClose={() => setModal({ kind: "none" })}
        />
      ) : null}
    </div>
  );
}
