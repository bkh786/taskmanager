"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { todayIso } from "@/lib/task-status";

function monthOptions(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const today = new Date(todayIso() + "T00:00:00");
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) + (i === 0 ? " (current)" : ""),
    });
  }
  return out;
}

const SELECT =
  "px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] text-text-main bg-panel-bg";

/**
 * Month and active/inactive choices for the list, board and calendar below the
 * KPI tiles. The tiles themselves never change with these.
 */
export function DatasetControls({
  month,
  userStatus,
  showStatus = true,
}: {
  month: string;
  userStatus: string;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = monthOptions(1)[0].value;

  function setParam(key: string, value: string, isDefault: boolean) {
    const p = new URLSearchParams(params.toString());
    if (value && !isDefault) p.set(key, value);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  const options = monthOptions(24);
  if (!options.some((o) => o.value === month)) options.push({ value: month, label: month });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-text-sub">
        Month
        <select value={month} onChange={(e) => setParam("month", e.target.value, e.target.value === current)} className={SELECT}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {showStatus ? (
      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-text-sub">
        Employees
        <select value={userStatus} onChange={(e) => setParam("userStatus", e.target.value, e.target.value === "active")} className={SELECT}>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">Active + inactive</option>
        </select>
      </label>
      ) : null}
    </div>
  );
}
