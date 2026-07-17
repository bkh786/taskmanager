import { requireRole } from "@/lib/auth";
import { getPlatformStats } from "@/lib/tenant-data";

const ROLE_LABELS: Record<string, string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

const BILLING_STYLE: Record<string, { bg: string; color: string }> = {
  Paid: { bg: "var(--success-soft)", color: "var(--success)" },
  Trial: { bg: "var(--accent-soft)", color: "var(--accent)" },
  Overdue: { bg: "var(--danger-soft)", color: "var(--danger)" },
  Cancelled: { bg: "var(--chip-bg)", color: "var(--text-faint)" },
};

export default async function PlatformDashboardPage() {
  await requireRole(["platform_owner"]);
  const stats = await getPlatformStats();

  return (
    <div>
      <div className="text-[22px] font-bold text-text-main mb-0.5">Platform Dashboard</div>
      <div className="text-[13.5px] text-text-sub mb-5.5">
        Organization summary and key metrics across every tenant
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-5.5">
        <StatCard label="Total Tenants" value={stats.totalTenants} />
        <StatCard label="Active Tenants" value={stats.activeTenants} />
        <StatCard label="Total Platform Users" value={stats.totalUsers} />
        <StatCard label="New Tenants (30d)" value={stats.newTenantsLast30Days} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5.5">
        <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
          <div className="text-[14.5px] font-bold text-text-main mb-3.5">
            Billing status summary
          </div>
          {Object.keys(stats.billingCounts).length === 0 ? (
            <div className="text-[13px] text-text-faint">No tenants yet.</div>
          ) : (
            Object.entries(stats.billingCounts).map(([status, count]) => {
              const style = BILLING_STYLE[status] ?? BILLING_STYLE.Trial;
              return (
                <div
                  key={status}
                  className="flex items-center justify-between py-2 border-b border-row-hover-border last:border-b-0"
                >
                  <span
                    className="text-xs font-semibold px-2.5 py-[3px] rounded-[5px]"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {status}
                  </span>
                  <span className="text-[13px] font-semibold text-text-main">{count} tenants</span>
                </div>
              );
            })
          )}
        </div>

        <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
          <div className="text-[14.5px] font-bold text-text-main mb-3.5">
            Platform users by role
          </div>
          {Object.keys(stats.usersByRole).length === 0 ? (
            <div className="text-[13px] text-text-faint">No users yet.</div>
          ) : (
            Object.entries(stats.usersByRole).map(([role, count]) => (
              <div
                key={role}
                className="flex items-center justify-between py-2 border-b border-row-hover-border last:border-b-0"
              >
                <span className="text-[13px] text-text-body">{ROLE_LABELS[role] ?? role}</span>
                <span className="text-[13px] font-semibold text-text-main">{count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[14.5px] font-bold text-text-main">Seat utilization</div>
          <div className="text-[12.5px] text-text-sub">
            {stats.totalUsers} of {stats.totalSeats || "∞"} seats used
          </div>
        </div>
        <div className="h-2 bg-table-head-bg rounded overflow-hidden mb-4">
          <div
            className="h-full bg-accent rounded"
            style={{ width: `${Math.min(stats.seatsUsedPct, 100)}%` }}
          />
        </div>

        <div className="text-[12.5px] font-bold text-text-sub uppercase mb-2">
          Tenants near their seat limit
        </div>
        {stats.tenantsNearLimit.length === 0 ? (
          <div className="text-[13px] text-text-faint">No tenants are near their limit.</div>
        ) : (
          stats.tenantsNearLimit.map((t) => (
            <div
              key={t.name}
              className="flex items-center justify-between py-2 border-b border-row-hover-border last:border-b-0"
            >
              <span className="text-[13px] text-text-body">{t.name}</span>
              <span className="text-[12.5px] font-semibold text-text-main">
                {t.userCount} / {t.maxUsers}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] px-4 py-3.5">
      <div className="text-[11px] font-bold text-text-sub uppercase tracking-wide">{label}</div>
      <div className="text-[22px] font-extrabold text-text-main mt-1">{value}</div>
    </div>
  );
}
