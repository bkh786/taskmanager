import { requireRole } from "@/lib/auth";
import { getTenants } from "@/lib/tenant-data";
import { TenantsTable } from "@/components/tenants/tenants-table";
import { NewTenantModal } from "@/components/tenants/new-tenant-modal";

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5.5">
        <StatCard label="Active Tenants" value={activeTenants} />
        <StatCard label="Total Seats" value={totalSeats} />
        <StatCard label="On Trial" value={onTrial} />
      </div>

      <TenantsTable tenants={tenants} />
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
