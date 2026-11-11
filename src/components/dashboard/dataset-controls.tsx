"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { todayIso } from "@/lib/task-status";

function labelFor(value: string, isCurrent: boolean): string {
  const [y, m] = value.split("-").map(Number);
  return (
    new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }) +
    (isCurrent ? " (current)" : "")
  );
}

/** Only months that have tasks, plus the current month and whatever is selected. */
function monthOptions(available: string[], selected: string, current: string) {
  const set = new Set<string>([...available, current, selected]);
  return [...set]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((value) => ({ value, label: labelFor(value, value === current) }));
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
  availableMonths = [],
}: {
  month: string;
  userStatus: string;
  showStatus?: boolean;
  availableMonths?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = todayIso().slice(0, 7);

  function setParam(key: string, value: string, isDefault: boolean) {
    const p = new URLSearchParams(params.toString());
    if (value && !isDefault) p.set(key, value);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  const options = monthOptions(availableMonths, month, current);

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
