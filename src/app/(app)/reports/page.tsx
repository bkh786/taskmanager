import { requireRole } from "@/lib/auth";
import { getReportRows } from "@/lib/report-data";
import { fmtDate } from "@/lib/task-status";
import { ExportButton } from "@/components/reports/export-button";

export default async function ReportsPage() {
  await requireRole(["reporting_manager"]);
  const rows = await getReportRows();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[22px] font-bold text-text-main">Reports</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Schema-matched task data — one row per instance
          </div>
        </div>
        <ExportButton rows={rows} appUrl={appUrl} />
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              {[
                "Task Name",
                "Assigned",
                "Due",
                "Completed",
                "Delay (d)",
                "Status",
                "Assignee",
                "Designation",
                "Project",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-3.5 py-2.5 text-[11px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  No task instances yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.instanceId}>
                  <td className="px-3.5 py-2.5 text-[13px] font-semibold text-text-main border-b border-row-hover-border whitespace-nowrap">
                    {r.taskName}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {fmtDate(r.assignedDate)}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {fmtDate(r.dueDate)}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {r.completedDate ? fmtDate(r.completedDate) : "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {r.delayInDays}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap capitalize">
                    {r.status}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {r.assigneeName}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {r.designation || "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {r.project || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
