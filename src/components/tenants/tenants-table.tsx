"use client";

import Link from "next/link";
import { fmtDate } from "@/lib/task-status";
import { useColumnFilters, type FilterCol } from "@/components/table-filters";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Active: { bg: "var(--success-soft)", color: "var(--success)" },
  Inactive: { bg: "var(--chip-bg)", color: "var(--text-faint)" },
};

const BILLING_STYLE: Record<string, { bg: string; color: string }> = {
  Paid: { bg: "var(--success-soft)", color: "var(--success)" },
  Trial: { bg: "var(--accent-soft)", color: "var(--accent)" },
  Overdue: { bg: "var(--danger-soft)", color: "var(--danger)" },
  Cancelled: { bg: "var(--chip-bg)", color: "var(--text-faint)" },
};

export type TenantRow = {
  id: string;
  name: string;
  adminEmail: string | null;
  plan: string;
  userCount: number;
  max_users: number | null;
  is_active: boolean | null;
  billing_status: string;
  created_at: string | null;
};

const COLS: FilterCol<TenantRow>[] = [
  { key: "tenant", label: "Tenant", value: (t) => t.name },
  { key: "admin", label: "Admin", value: (t) => t.adminEmail ?? "—" },
  { key: "plan", label: "Plan", value: (t) => t.plan },
  { key: "users", label: "Users / Limit", value: (t) => `${t.userCount} / ${t.max_users ?? "∞"}` },
  { key: "status", label: "Status", value: (t) => (t.is_active ? "Active" : "Inactive") },
  { key: "billing", label: "Billing", value: (t) => t.billing_status },
  { key: "created", label: "Created", value: (t) => (t.created_at ? fmtDate(t.created_at) : "—") },
];

const td = "px-4 py-2.5 border-b border-row-hover-border whitespace-nowrap";

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  const cf = useColumnFilters(tenants, COLS);
  const rows = cf.filtered;

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-table-head-bg">
            {COLS.map((c) => (
              <th
                key={c.key}
                className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5">
                  {c.label}
                  {cf.headerButton(c.key)}
                </span>
              </th>
            ))}
            <th className="px-4 py-2.5 border-b border-panel-border" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-text-faint">
                {tenants.length === 0 ? "No tenants yet." : "No tenants match these filters."}
              </td>
            </tr>
          ) : (
            rows.map((t) => {
              const status = t.is_active ? "Active" : "Inactive";
              const statusStyle = STATUS_STYLE[status];
              const billingStyle = BILLING_STYLE[t.billing_status] ?? BILLING_STYLE.Trial;
              return (
                <tr key={t.id}>
                  <td className={`${td} text-[13.5px] font-semibold text-text-main`}>{t.name}</td>
                  <td className={`${td} text-[13px] text-text-body`}>{t.adminEmail ?? "—"}</td>
                  <td className={`${td} text-[13px] text-text-body`}>{t.plan}</td>
                  <td className={`${td} text-[13px] text-text-body`}>
                    {t.userCount} / {t.max_users ?? "∞"}
                  </td>
                  <td className={td}>
                    <span
                      className="text-xs font-semibold px-2.5 py-[3px] rounded-[5px]"
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      {status}
                    </span>
                  </td>
                  <td className={td}>
                    <span
                      className="text-xs font-semibold px-2.5 py-[3px] rounded-[5px]"
                      style={{ background: billingStyle.bg, color: billingStyle.color }}
                    >
                      {t.billing_status}
                    </span>
                  </td>
                  <td className={`${td} text-[13px] text-text-body`}>
                    {t.created_at ? fmtDate(t.created_at) : "—"}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`/tenants/${t.id}`}
                      className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {cf.menu}
    </div>
  );
}
