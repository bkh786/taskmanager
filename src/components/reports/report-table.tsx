import type { ReportRow } from "@/lib/report-data";
import { fmtDate } from "@/lib/task-status";

export function ReportTable({
  rows,
  showOrganization = false,
}: {
  rows: ReportRow[];
  showOrganization?: boolean;
}) {
  const headers = [
    ...(showOrganization ? ["Organization"] : []),
    "Task Name",
    "Assigned",
    "Due",
    "Completed",
    "Delay (d)",
    "Status",
    "Assignee",
    "Designation",
    "Project",
  ];

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-table-head-bg">
            {headers.map((h) => (
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
              <td
                colSpan={headers.length}
                className="px-4 py-6 text-center text-[13px] text-text-faint"
              >
                No task instances match these filters.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.instanceId}>
                {showOrganization ? (
                  <td className="px-3.5 py-2.5 text-[12.5px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                    {r.organization}
                  </td>
                ) : null}
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
  );
}
