import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  getReportRows,
  resolveReportRange,
  type ReportFilters as Filters,
} from "@/lib/report-data";
import { getAttachmentSignedUrls } from "@/lib/attachments";
import { ReportView } from "@/components/reports/report-view";
import { ReportFilters } from "@/components/reports/report-filters";
import { getReportOptions } from "@/lib/report-options";
import { ScoreTable } from "@/components/reports/score-table";
import { scoreByEmployee } from "@/lib/task-score";
import { fmtDate } from "@/lib/task-status";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["reporting_manager", "master_admin", "user"]);
  const sp = await searchParams;
  const view = sp.view === "reports" ? "reports" : "score";

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

  const tabs = (
    <div className="flex gap-1 border-b border-panel-border mb-4">
      {(
        [
          ["score", "Task Performance Score"],
          ["reports", "Task Reports"],
        ] as const
      ).map(([key, label]) => (
        <Link
          key={key}
          href={`/reports?view=${key}`}
          className="px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap -mb-px border-b-2"
          style={{
            borderColor: key === view ? "var(--accent)" : "transparent",
            color: key === view ? "var(--accent)" : "var(--text-sub)",
          }}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  const filterBar = (
    <ReportFilters
      view={view}
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
  );

  if (view === "score") {
    const scores = scoreByEmployee(rows, effectiveRange.to);
    const exportQuery = new URLSearchParams(
      Object.entries(sp).filter(([k, v]) => v !== undefined && !["view", "applied", "assignee"].includes(k)) as [string, string][]
    ).toString();
    return (
      <div>
        <div className="text-[22px] font-bold text-text-main">Task Reports</div>
        {tabs}
        <div className="text-[13.5px] text-text-sub mb-4">
          Task score = tasks completed on time ÷ tasks due, per employee.
          {applied
            ? ` Period: ${fmtDate(effectiveRange.from)} – ${fmtDate(effectiveRange.to)}${isDefaultView ? " (current month, default)" : ""}.`
            : " Choose the period and click Apply to calculate."}
        </div>
        <div className="mb-4">{filterBar}</div>
        <ScoreTable scores={scores} applied={applied} exportQuery={exportQuery} />
      </div>
    );
  }

  const signedUrls = await getAttachmentSignedUrls(
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
      appUrl={appUrl}
      heading={
        <div>
          <div className="text-[22px] font-bold text-text-main">Task Reports</div>
          {tabs}
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
      }
      filters={filterBar}
    />
  );
}
