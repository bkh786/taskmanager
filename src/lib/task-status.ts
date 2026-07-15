import type { Enums } from "@/types/database.types";

export type Bucket = "today" | "week" | "delayed" | "completed" | "upcoming";

export const BUCKET_META: Record<
  Bucket,
  { label: string; color: string; bg: string }
> = {
  today: {
    label: "Due Today",
    color: "oklch(0.45 0.16 250)",
    bg: "oklch(0.94 0.03 250)",
  },
  week: {
    label: "Due This Week",
    color: "oklch(0.5 0.15 70)",
    bg: "oklch(0.94 0.06 70)",
  },
  delayed: {
    label: "Delayed",
    color: "oklch(0.48 0.18 25)",
    bg: "oklch(0.94 0.05 25)",
  },
  completed: {
    label: "Completed",
    color: "oklch(0.45 0.13 145)",
    bg: "oklch(0.93 0.05 145)",
  },
  upcoming: {
    label: "Upcoming",
    color: "oklch(0.45 0.02 250)",
    bg: "oklch(0.94 0.01 250)",
  },
};

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function bucketOf(instance: {
  status: Enums<"instance_status"> | null;
  due_date: string;
}): Bucket {
  if (instance.status === "completed") return "completed";
  const today = todayIso();
  const weekOut = addDaysIso(today, 6);
  if (instance.due_date < today) return "delayed";
  if (instance.due_date === today) return "today";
  if (instance.due_date <= weekOut) return "week";
  return "upcoming";
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** completed_at - due_date in whole days, floored at 0 (per report spec). */
export function delayDays(dueDate: string, completedAt: string | null): number {
  if (!completedAt) return 0;
  const due = new Date(dueDate + "T00:00:00");
  const completed = new Date(completedAt);
  const diff = Math.floor(
    (Date.UTC(completed.getFullYear(), completed.getMonth(), completed.getDate()) -
      Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())) /
      86400000
  );
  return Math.max(0, diff);
}
