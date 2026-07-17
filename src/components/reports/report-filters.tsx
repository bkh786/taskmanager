"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { todayIso } from "@/lib/task-status";

function lastMonths(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const today = new Date(todayIso() + "T00:00:00");
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    out.push({ value, label });
  }
  return out;
}

export function ReportFilters({
  dateFrom,
  dateTo,
  months,
}: {
  dateFrom: string;
  dateTo: string;
  months: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [monthsOpen, setMonthsOpen] = useState(false);
  const monthOptions = lastMonths(12);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  function toggleMonth(value: string) {
    const next = months.includes(value)
      ? months.filter((m) => m !== value)
      : [...months, value];
    setParam("months", next.join(","));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-semibold text-text-sub">From</label>
        <input
          type="date"
          value={dateFrom}
          max={todayIso()}
          onChange={(e) => setParam("dateFrom", e.target.value)}
          className="px-2 py-1.5 border border-panel-border rounded-md text-[12.5px] text-text-main bg-panel-bg"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-[11.5px] font-semibold text-text-sub">To</label>
        <input
          type="date"
          value={dateTo}
          max={todayIso()}
          onChange={(e) => setParam("dateTo", e.target.value)}
          className="px-2 py-1.5 border border-panel-border rounded-md text-[12.5px] text-text-main bg-panel-bg"
        />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMonthsOpen((o) => !o)}
          className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer whitespace-nowrap"
        >
          Months {months.length > 0 ? `(${months.length})` : "(all)"}
        </button>
        {monthsOpen ? (
          <div className="absolute z-10 top-full mt-1.5 right-0 w-[180px] max-h-[260px] overflow-y-auto bg-panel-bg border border-panel-border rounded-md shadow-lg p-2">
            {monthOptions.map((m) => (
              <label
                key={m.value}
                className="flex items-center gap-2 text-[12.5px] text-text-body px-1.5 py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={months.includes(m.value)}
                  onChange={() => toggleMonth(m.value)}
                />
                {m.label}
              </label>
            ))}
            {months.length > 0 ? (
              <button
                type="button"
                onClick={() => setParam("months", "")}
                className="text-[11.5px] text-accent font-semibold mt-1 px-1.5"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {dateFrom || dateTo || months.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams(params.toString());
            p.delete("dateFrom");
            p.delete("dateTo");
            p.delete("months");
            router.push(`${pathname}?${p.toString()}`);
          }}
          className="text-[12px] text-text-faint underline cursor-pointer"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
