"use client";

import * as XLSX from "xlsx";
import type { Employee } from "@/lib/org-data";
import type { AppUser } from "@/lib/auth";

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

export function ExportUsersButton({ users }: { users: Employee[] }) {
  function download() {
    const data = users.map((u) => ({
      Name: u.full_name,
      Email: u.email,
      Role: ROLE_LABELS[u.system_role],
      Project: u.project_name ?? "",
      Status: u.is_active ? "Active" : "Inactive",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, `user-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <button
      onClick={download}
      disabled={users.length === 0}
      type="button"
      className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
    >
      ⬇ Download Excel
    </button>
  );
}
