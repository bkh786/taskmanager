import Link from "next/link";
import type { DashboardInstance } from "@/lib/dashboard-data";
import { bucketOf, BUCKET_META, todayIso } from "@/lib/task-status";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  instances,
  monthIso,
}: {
  instances: DashboardInstance[];
  /** "YYYY-MM" */
  monthIso: string;
}) {
  const [year, month] = monthIso.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const today = todayIso();

  const byDay = new Map<string, DashboardInstance[]>();
  for (const i of instances) {
    if (!i.due_date.startsWith(monthIso)) continue;
    if (!byDay.has(i.due_date)) byDay.set(i.due_date, []);
    byDay.get(i.due_date)!.push(i);
  }

  const cells: { day: number; iso: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: `${monthIso}-${String(d).padStart(2, "0")}` });
  }
  const leading = Array.from({ length: startWeekday }, () => null);
  const allCells = [...leading, ...cells];
  while (allCells.length % 7 !== 0) allCells.push(null);
  const weeks: (typeof allCells)[] = [];
  for (let i = 0; i < allCells.length; i += 7) weeks.push(allCells.slice(i, i + 7));

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
      <div className="grid grid-cols-7 bg-table-head-bg border-b border-panel-border">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2.5 py-2 text-[11px] font-bold text-text-sub uppercase text-center"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-row-hover-border last:border-b-0">
          {week.map((cell, ci) => (
            <div
              key={ci}
              className="min-h-[92px] border-r border-row-hover-border last:border-r-0 px-1.5 py-1.5"
              style={{ background: cell?.iso === today ? "var(--accent-soft)" : undefined }}
            >
              {cell ? (
                <>
                  <div
                    className="text-[11.5px] font-semibold mb-1"
                    style={{ color: cell.iso === today ? "var(--accent)" : "var(--text-main)" }}
                  >
                    {cell.day}
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    {(byDay.get(cell.iso) ?? []).slice(0, 4).map((t) => {
                      const meta = BUCKET_META[bucketOf(t)];
                      return (
                        <Link
                          key={t.id}
                          href={`/tasks/${t.id}`}
                          className="block text-[10.5px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {t.task_name}
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
