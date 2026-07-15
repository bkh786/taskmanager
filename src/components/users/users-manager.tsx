"use client";

import { useState } from "react";
import type { Employee } from "@/lib/org-data";
import type { AppUser } from "@/lib/auth";
import { UserModal } from "./user-modal";

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

export function UsersManager({
  users,
  managers,
  allowedRoles,
  showReportsTo,
}: {
  users: Employee[];
  managers: Employee[];
  allowedRoles: AppUser["system_role"][];
  showReportsTo: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState<Employee | null>(null);

  function openAdd() {
    setTarget(null);
    setModalOpen(true);
  }
  function openReplace(u: Employee) {
    setTarget(u);
    setModalOpen(true);
  }
  function close() {
    setModalOpen(false);
    setTarget(null);
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
        <button
          onClick={openAdd}
          className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap"
        >
          + Add User
        </button>
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              {["Name", "Email", "Role", "Project", ""].map((h) => (
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
                <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-text-faint">
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
                    {u.email}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {ROLE_LABELS[u.system_role]}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                    {u.project_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 border-b border-row-hover-border text-right">
                    <button
                      onClick={() => openReplace(u)}
                      className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer"
                    >
                      Replace
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <UserModal
          employees={users}
          managers={managers}
          allowedRoles={allowedRoles}
          showReportsTo={showReportsTo}
          presetTarget={target}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
