import { type ReportFilters } from "@/lib/report-data";

/** The report filters as carried in the page / download URL. */
export function parseReportFilters(sp: Record<string, string | undefined>): ReportFilters {
  const list = (k: string) => (sp[k] ? sp[k]!.split(",").filter(Boolean) : []);
  return {
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    months: list("months"),
    projectIds: list("projects"),
    designationIds: list("designations"),
    roles: list("roles"),
    statuses: list("statuses"),
    assignedByIds: list("assignedBy"),
  };
}
