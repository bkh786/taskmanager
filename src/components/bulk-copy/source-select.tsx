"use client";

import { useRouter } from "next/navigation";
import type { Employee } from "@/lib/org-data";

export function SourceSelect({
  employees,
  sourceId,
}: {
  employees: Employee[];
  sourceId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={sourceId}
      onChange={(e) => router.push(`/bulk-copy?source=${e.target.value}`)}
      className="w-full max-w-[320px] px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
    >
      <option value="">Select a user…</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.full_name}
        </option>
      ))}
    </select>
  );
}
