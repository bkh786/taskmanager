import Link from "next/link";
import type { TaskGroup } from "@/lib/dashboard-data";
import { fmtDate } from "@/lib/task-status";
import { StatusBadge } from "./status-badge";
import { RecurrenceBadge } from "./recurrence-badge";

export function TableView({ tasks }: { tasks: TaskGroup[] }) {
  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-table-head-bg">
            {["Task", "Recurrence", "Assignee", "Project", "Due date", "Status"].map((h) => (
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
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-text-faint">
                No tasks to show.
              </td>
            </tr>
          ) : (
            tasks.map((t) => (
              <tr key={t.taskId}>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <Link
                    href={`/tasks/${t.representative.id}`}
                    className="text-[13.5px] font-semibold text-text-main hover:text-accent"
                  >
                    {t.taskName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <RecurrenceBadge isRecurring={t.isRecurring} recurrenceKind={t.recurrenceKind} />
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {t.assigneeName}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {t.projectName ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border">
                  {fmtDate(t.representative.due_date)}
                </td>
                <td className="px-4 py-2.5 border-b border-row-hover-border">
                  <StatusBadge instance={t.representative} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
