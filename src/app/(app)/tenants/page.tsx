import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTenants } from "@/lib/tenant-data";
import { fmtDate } from "@/lib/task-status";
import { NewTenantModal } from "@/components/tenants/new-tenant-modal";

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

export default async function TenantsPage() {
  await requireRole(["platform_owner"]);
  const tenants = await getTenants();

  const activeTenants = tenants.filter((t) => t.is_active).length;
  const totalSeats = tenants.reduce((sum, t) => sum + (t.max_users ?? 0), 0);
  const onTrial = tenants.filter((t) => t.billing_status === "Trial").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[22px] font-bold text-text-main">Tenants</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Create and provision organizations on the platform
          </div>
        </div>
        <NewTenantModal />
      </div>

      <div className="grid grid-cols-3 gap-3.5 mb-5.5">
        <StatCard label="Active Tenants" value={activeTenants} />
        <StatCard label="Total Seats" value={totalSeats} />
        <StatCard label="On Trial" value={onTrial} />
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              {["Tenant", "Admin", "Plan", "Users / Limit", "Status", "Billing", "Created", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  No tenants yet.
                </td>
              </tr>
            ) : (
              tenants.map((t) => {
                const status = t.is_active ? "Active" : "Inactive";
                const statusStyle = STATUS_STYLE[status];
                const billingStyle = BILLING_STYLE[t.billing_status] ?? BILLING_STYLE.Trial;
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 text-[13.5px] font-semibold text-text-main border-b border-row-hover-border whitespace-nowrap">
                      {t.name}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                      {t.adminEmail ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                      {t.plan}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                      {t.userCount} / {t.max_users ?? "∞"}
                    </td>
                    <td className="px-4 py-2.5 border-b border-row-hover-border whitespace-nowrap">
                      <span
                        className="text-xs font-semibold px-2.5 py-[3px] rounded-[5px]"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 border-b border-row-hover-border whitespace-nowrap">
                      <span
                        className="text-xs font-semibold px-2.5 py-[3px] rounded-[5px]"
                        style={{ background: billingStyle.bg, color: billingStyle.color }}
                      >
                        {t.billing_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-text-body border-b border-row-hover-border whitespace-nowrap">
                      {t.created_at ? fmtDate(t.created_at) : "—"}
                    </td>
                    <td className="px-4 py-2.5 border-b border-row-hover-border whitespace-nowrap text-right">
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
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] px-4 py-3.5">
      <div className="text-[11px] font-bold text-text-sub uppercase tracking-wide">
        {label}
      </div>
      <div className="text-[22px] font-extrabold text-text-main mt-1">{value}</div>
    </div>
  );
}
