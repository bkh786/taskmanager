// Task performance score: tasks completed on time / tasks due in the period.

import type { ReportRow } from "@/lib/report-data";

export type ScoredTask = {
  row: ReportRow;
  /** YYYY-MM-DD: when it was completed, or for open tasks the period's end (or today). */
  completionDate: string;
  completed: boolean;
  /** Whole days late, never below 0. */
  delay: number;
};

export type EmployeeScore = {
  assigneeId: string;
  name: string;
  employeeCode: string;
  designation: string;
  project: string;
  manager: string;
  due: number;
  onTime: number;
  score: number; // 0..1
};

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function localDateOf(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A completed task finishes on its completion date. A task that is still
 * open has no completion date, so the end of the selected period (never later
 * than today) stands in for it, and the delay is measured to that date.
 * Only completed tasks with no delay count as on time.
 */
export function scoreTasks(rows: ReportRow[], periodEnd: string): ScoredTask[] {
  return rows.map((row) => {
    const completed = row.status === "completed" && !!row.completedDate;
    const completionDate = completed ? localDateOf(row.completedDate!) : periodEnd;
    const delay = Math.max(0, dayNumber(completionDate) - dayNumber(row.dueDate));
    return { row, completionDate, completed, delay };
  });
}

export function isOnTime(t: ScoredTask): boolean {
  return t.completed && t.delay <= 0;
}

export function scoreByEmployee(rows: ReportRow[], periodEnd: string): EmployeeScore[] {
  const by = new Map<string, EmployeeScore>();
  for (const t of scoreTasks(rows, periodEnd)) {
    const r = t.row;
    let e = by.get(r.assigneeId);
    if (!e) {
      e = {
        assigneeId: r.assigneeId,
        name: r.assigneeName,
        employeeCode: r.employeeCode,
        designation: r.designation,
        project: r.project,
        manager: r.managerName,
        due: 0,
        onTime: 0,
        score: 0,
      };
      by.set(r.assigneeId, e);
    }
    e.due++;
    if (isOnTime(t)) e.onTime++;
  }
  for (const e of by.values()) e.score = e.due ? e.onTime / e.due : 0;
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
