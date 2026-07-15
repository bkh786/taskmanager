import Link from "next/link";
import type { DashboardInstance } from "@/lib/dashboard-data";
import { fmtDate } from "@/lib/task-status";
import { StatusBadge } from "./status-badge";

export function TableView({ instances }: { instances: DashboardInstance[] }) {
  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-table-head-bg">
            {["Task", "Assignee", "Project", "Due date", "Status"].map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase tracking-wide border-b border-panel-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {instances.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-text-faint">
                No tasks to show.
              </td>
            </tr>
          ) : (
            instances.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <Link
                    href={`/tasks/${i.id}`}
                    className="text-[13.5px] font-semibold text-text-main hover:text-accent"
                  >
                    {i.task_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {i.assignee_name}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {i.project_name ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {fmtDate(i.due_date)}
                </td>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <StatusBadge instance={i} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
