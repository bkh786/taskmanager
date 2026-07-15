import Link from "next/link";
import type { DashboardInstance } from "@/lib/dashboard-data";
import { bucketOf, fmtDate, type Bucket } from "@/lib/task-status";
import { StatusBadge } from "./status-badge";

const COLUMNS: { id: Bucket; label: string; dot: string }[] = [
  { id: "today", label: "Due Today", dot: "oklch(0.55 0.14 250)" },
  { id: "week", label: "Due This Week", dot: "oklch(0.62 0.14 70)" },
  { id: "delayed", label: "Delayed", dot: "oklch(0.5 0.18 25)" },
  { id: "completed", label: "Completed", dot: "oklch(0.48 0.13 145)" },
];

export function KanbanView({ instances }: { instances: DashboardInstance[] }) {
  const byBucket = new Map<Bucket, DashboardInstance[]>();
  for (const i of instances) {
    const b = bucketOf(i);
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b)!.push(i);
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
            {items.map((i) => (
              <Link
                key={i.id}
                href={`/tasks/${i.id}`}
                className="block bg-panel-bg border border-panel-border rounded-lg px-3 py-2.5 mb-2"
              >
                <div
                  className="text-[13px] font-semibold text-text-main mb-1.5"
                  style={
                    col.id === "completed"
                      ? { textDecoration: "line-through", textDecorationColor: "#c9c8c3" }
                      : undefined
                  }
                >
                  {i.task_name}
                </div>
                <div className="text-[11.5px] text-text-sub mb-2">
                  {i.assignee_name} · {i.project_name ?? "No project"}
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge instance={i} />
                  <span className="text-[10.5px] text-text-faint">{fmtDate(i.due_date)}</span>
                </div>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
