import { requireRole } from "@/lib/auth";
import { getPlatformReportRows, type ReportFilters as Filters } from "@/lib/report-data";
import { ExportButton } from "@/components/reports/export-button";
import { ReportTable } from "@/components/reports/report-table";
import { ReportFilters } from "@/components/reports/report-filters";

export default async function PlatformReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["platform_owner"]);
  const sp = await searchParams;

  const dateFrom = sp.dateFrom ?? "";
  const dateTo = sp.dateTo ?? "";
  const months = sp.months ? sp.months.split(",").filter(Boolean) : [];
  const filters: Filters = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, months };

  const rows = await getPlatformReportRows(filters);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[22px] font-bold text-text-main">Platform Reports</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Task data across every tenant. Future tasks are excluded.
          </div>
        </div>
        <ExportButton rows={rows} appUrl={appUrl} showOrganization />
      </div>

      <div className="mb-4">
        <ReportFilters dateFrom={dateFrom} dateTo={dateTo} months={months} />
      </div>

      <ReportTable rows={rows} showOrganization />
    </div>
  );
}
