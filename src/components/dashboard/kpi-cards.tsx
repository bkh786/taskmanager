export function KpiCards({
  kpis,
  uniqueTaskTotal,
}: {
  kpis: { total: number; today: number; week: number; delayed: number; completed: number };
  /** "Total Tasks" counts distinct tasks, not instances -- a weekly task
   * with 9 upcoming occurrences is still one task. */
  uniqueTaskTotal: number;
}) {
  const cards = [
    { label: "Total Tasks", value: uniqueTaskTotal, dot: null },
    { label: "Due Today", value: kpis.today, dot: "oklch(0.45 0.16 250)" },
    { label: "Due This Week", value: kpis.week, dot: "oklch(0.5 0.15 70)" },
    { label: "Delayed", value: kpis.delayed, dot: "oklch(0.48 0.18 25)" },
    { label: "Completed", value: kpis.completed, dot: "oklch(0.45 0.13 145)" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3.5 mb-5.5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-panel-bg border border-panel-border rounded-[10px] px-4 py-3.5"
        >
          <div className="flex items-center gap-1.5">
            {c.dot ? (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: c.dot }}
              />
            ) : null}
            <div className="text-[11px] font-bold text-text-sub uppercase tracking-wide">
              {c.label}
            </div>
          </div>
          <div className="text-[22px] font-extrabold text-text-main mt-1">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
