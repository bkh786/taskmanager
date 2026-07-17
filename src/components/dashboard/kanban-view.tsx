import Link from "next/link";
import type { TaskGroup } from "@/lib/dashboard-data";
import { bucketOf, fmtDate, type Bucket } from "@/lib/task-status";
import { StatusBadge } from "./status-badge";
import { RecurrenceBadge } from "./recurrence-badge";

const COLUMNS: { id: Bucket; label: string; dot: string }[] = [
  { id: "today", label: "Due Today", dot: "oklch(0.55 0.14 250)" },
  { id: "week", label: "Upcoming Due", dot: "oklch(0.62 0.14 70)" },
  { id: "delayed", label: "Delayed", dot: "oklch(0.5 0.18 25)" },
  { id: "completed", label: "Completed", dot: "oklch(0.48 0.13 145)" },
];

export function KanbanView({ tasks }: { tasks: TaskGroup[] }) {
  const byBucket = new Map<Bucket, TaskGroup[]>();
  for (const t of tasks) {
    const b = bucketOf(t.representative);
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b)!.push(t);
  }

  return (
    <div className="grid grid-cols-4 gap-3.5">
      {COLUMNS.map((col) => {
        const items = byBucket.get(col.id) ?? [];
        return (
          <div key={col.id} className="bg-chip-bg rounded-[10px] p-2.5 min-h-[320px]">
            <div className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
              <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
              <span className="text-[12.5px] font-bold text-text-main">{col.label}</span>
              <span className="text-[11px] text-text-faint">{items.length}</span>
            </div>
            {items.map((t) => (
              <Link
                key={t.taskId}
                href={`/tasks/${t.representative.id}`}
                className="block bg-panel-bg border border-panel-border rounded-lg px-3 py-2.5 mb-2"
              >
                <div className="flex items-start gap-1.5 mb-1.5">
                  <div
                    className="text-[13px] font-semibold text-text-main flex-1"
                    style={
                      col.id === "completed"
                        ? { textDecoration: "line-through", textDecorationColor: "#c9c8c3" }
                        : undefined
                    }
                  >
                    {t.taskName}
                  </div>
                  <RecurrenceBadge isRecurring={t.isRecurring} recurrenceKind={t.recurrenceKind} />
                </div>
                <div className="text-[11.5px] text-text-sub mb-2">
                  {t.assigneeName} · {t.projectName ?? "No project"}
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge instance={t.representative} />
                  <span className="text-[10.5px] text-text-faint">
                    {fmtDate(t.representative.due_date)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
