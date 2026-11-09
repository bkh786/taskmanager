import { requireRole } from "@/lib/auth";
import {
  getReportRows,
  resolveReportRange,
  type ReportFilters as Filters,
} from "@/lib/report-data";
import { getAttachmentSignedUrls } from "@/lib/attachments";
import { ExportButton } from "@/components/reports/export-button";
import { ReportTable } from "@/components/reports/report-table";
import { ReportFilters } from "@/components/reports/report-filters";
import { getReportOptions } from "@/lib/report-options";
import { fmtDate } from "@/lib/task-status";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["reporting_manager", "master_admin", "user"]);
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
    applied ? getReportRows(appUser, filters) : Promise.resolve([]),
    getReportOptions(appUser),
  ]);
  const effectiveRange = resolveReportRange(filters);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const signedUrls = await getAttachmentSignedUrls(
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
          <div className="text-[22px] font-bold text-text-main">Reports</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            {appUser.system_role === "user"
              ? "Your own tasks — one row per instance"
              : "Schema-matched task data — one row per instance"}
            .
            {applied
              ? ` Showing due dates ${fmtDate(effectiveRange.from)} – ${fmtDate(effectiveRange.to)}${isDefaultView ? " (current month, default)" : ""}.`
              : " Choose filters and click Apply to load data."}
          </div>
        </div>
        <ExportButton rows={rows} appUrl={appUrl} />
      </div>

      <div className="mb-4">
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
      </div>

      <ReportTable applied={applied} rows={rows} attachmentUrls={attachmentUrls} />
    </div>
  );
}
