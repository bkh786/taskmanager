"use client";

import * as XLSX from "xlsx";
import type { ReportRow } from "@/lib/report-data";
import { fmtDate } from "@/lib/task-status";

export function ExportButton({
  rows,
  appUrl,
}: {
  rows: ReportRow[];
  appUrl: string;
}) {
  function download() {
    const data = rows.map((r) => ({
      "Task Name": r.taskName,
      "Assigned Date": fmtDate(r.assignedDate),
      "Due Date": fmtDate(r.dueDate),
      "Completion Date": r.completedDate ? fmtDate(r.completedDate) : "",
      "Delay (days)": r.delayInDays,
      Status: r.status,
      "Completion Evidence": r.evidencePath ? `${appUrl}/tasks/${r.instanceId}` : "",
      Comment: r.comment,
      "Assignee Name": r.assigneeName,
      Designation: r.designation,
      Project: r.project,
      "Date of Joining": r.dateOfJoining ? fmtDate(r.dateOfJoining) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `task-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <button
      onClick={download}
      disabled={rows.length === 0}
      className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
    >
      ⬇ Download Excel
    </button>
  );
}
