import { BUCKET_META, bucketOf, fmtDate, type Bucket } from "@/lib/task-status";
import type { DashboardInstance } from "@/lib/dashboard-data";

export function StatusBadge({ instance }: { instance: DashboardInstance }) {
  if (instance.status === "removed") {
    return (
      <span className="text-[12px] font-semibold px-2.5 py-[3px] rounded-[5px] whitespace-nowrap bg-chip-bg text-text-faint">
        Removed
      </span>
    );
  }
  const bucket = bucketOf(instance);
  const meta = BUCKET_META[bucket];
  return (
    <span
      className="text-[12px] font-semibold px-2.5 py-[3px] rounded-[5px] whitespace-nowrap"
      style={{ background: meta.bg, color: meta.color }}
    >
      {bucket === "completed" || bucket === "delayed"
        ? meta.label
        : fmtDate(instance.due_date)}
    </span>
  );
}

export function bucketLabel(b: Bucket) {
  return BUCKET_META[b].label;
}
