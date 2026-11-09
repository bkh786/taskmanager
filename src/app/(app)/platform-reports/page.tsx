import { requireRole } from "@/lib/auth";
import {
  getPlatformReportRows,
  resolveReportRange,
  type ReportFilters as Filters,
} from "@/lib/report-data";
import { getAttachmentSignedUrlsAdmin } from "@/lib/attachments";
import { ReportView } from "@/components/reports/report-view";
import { ReportFilters } from "@/components/reports/report-filters";
import { getPlatformReportOptions } from "@/lib/report-options";
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
  const list = (k: string) => (sp[k] ? sp[k]!.split(",").filter(Boolean) : []);
  const applied = sp.applied === "1";
  const projectIds = list("projects");
  const designationIds = list("designations");
  const roles = list("roles");
  const statuses = list("statuses");
  const assignedByIds = list("assignedBy");
  const filters: Filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    months,
    projectIds,
    designationIds,
    roles,
    statuses,
    assignedByIds,
  };
  const isDefaultView = !dateFrom && !dateTo && months.length === 0;

  // Nothing is loaded until the user picks filters and clicks Apply.
  const [rows, options] = await Promise.all([
    applied ? getPlatformReportRows(filters) : Promise.resolve([]),
    getPlatformReportOptions(),
  ]);
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
    <ReportView
      applied={applied}
      rows={rows}
      attachmentUrls={attachmentUrls}
      appUrl={appUrl} showOrganization
      heading={
        <div>
          <div className="text-[22px] font-bold text-text-main">Platform Reports</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Task data across every tenant.
            {applied
              ? ` Showing due dates ${fmtDate(effectiveRange.from)} – ${fmtDate(effectiveRange.to)}${isDefaultView ? " (current month, default)" : ""}.`
              : " Choose filters and click Apply to load data."}
          </div>
        </div>
      }
      filters={
        <ReportFilters
          options={options}
          applied={applied}
          defaultFrom={effectiveRange.from}
          defaultTo={effectiveRange.to}
          initial={{
            dateFrom: dateFrom || effectiveRange.from,
            dateTo: dateTo || effectiveRange.to,
            months,
            projects: projectIds,
            designations: designationIds,
            roles,
            statuses,
            assignedBy: assignedByIds,
          }}
        />
      }
    />
  );
}
