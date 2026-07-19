"use client";

import { useState } from "react";
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

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              {["Name", "Employee Code", "Email", "Role", "Project", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
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
