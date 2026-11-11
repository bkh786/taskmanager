import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoicesTable, RunBillingButton, type InvoiceRow } from "@/components/platform/invoices-table";
import { formatMoney } from "@/lib/billing-shared";

export default async function InvoicesPage() {
  await requireRole(["platform_owner"]);
  const admin = createAdminClient();
  const [{ data: invoices }, { data: orgs }] = await Promise.all([
    admin.from("invoices").select("*").order("issued_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    admin.from("organizations").select("id, name"),
  ]);
  const names = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const rows: InvoiceRow[] = (invoices ?? []).map((i) => ({ ...i, org_name: names.get(i.org_id) }));

  const sum = (f: (i: InvoiceRow) => boolean) => rows.filter(f).reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = sum((i) => i.status === "pending" || i.status === "overdue");
  const overdue = sum((i) => i.status === "overdue");
  const paid = sum((i) => i.status === "paid");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="text-[22px] font-bold text-text-main">Invoices</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Raised automatically on the first day of each tenant&apos;s billing cycle (daily job, 6:00 AM IST)
          </div>
        </div>
        <RunBillingButton />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        {[
          ["Outstanding", formatMoney(outstanding)],
          ["Overdue", formatMoney(overdue)],
          ["Collected", formatMoney(paid)],
        ].map(([l, v]) => (
          <div key={l} className="bg-panel-bg border border-panel-border rounded-[10px] px-4 py-3.5">
            <div className="text-[11px] font-bold text-text-sub uppercase tracking-wide">{l}</div>
            <div className="text-[22px] font-extrabold text-text-main mt-1">{v}</div>
          </div>
        ))}
      </div>
      <InvoicesTable invoices={rows} showTenant />
    </div>
  );
}
