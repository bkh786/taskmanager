import { requireRole } from "@/lib/auth";
import {
  getPlatformReportRows,
  resolveReportRange,
  type ReportFilters as Filters,
} from "@/lib/report-data";
import { getAttachmentSignedUrlsAdmin } from "@/lib/attachments";
import { ExportButton } from "@/components/reports/export-button";
import { ReportTable } from "@/components/reports/report-table";
import { ReportFilters } from "@/components/reports/report-filters";
import { fmtDate } from "@/lib/task-status";

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
  const isDefaultView = !dateFrom && !dateTo && months.length === 0;

  const rows = await getPlatformReportRows(filters);
  const effectiveRange = resolveReportRange(filters);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const signedUrls = await getAttachmentSignedUrlsAdmin(
    rows.map((r) => r.evidencePath).filter(Boolean)
  );
  const attachmentUrls = Object.fromEntries(
    rows
      .filter((r) => r.evidencePath && signedUrls.has(r.evidencePath))
      .map((r) => [r.instanceId, signedUrls.get(r.evidencePath)!])
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[22px] font-bold text-text-main">Platform Reports</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Task data across every tenant. Showing {fmtDate(effectiveRange.from)} –{" "}
            {fmtDate(effectiveRange.to)}
            {isDefaultView ? " (current month, default)" : ""}.
          </div>
        </div>
        <ExportButton rows={rows} appUrl={appUrl} showOrganization />
      </div>

      <div className="mb-4">
        <ReportFilters
          dateFrom={dateFrom || effectiveRange.from}
          dateTo={dateTo || effectiveRange.to}
          months={months}
        />
      </div>

      <ReportTable rows={rows} attachmentUrls={attachmentUrls} showOrganization />
    </div>
  );
}
