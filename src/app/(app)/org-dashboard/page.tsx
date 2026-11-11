import { getThoughtOfTheDay } from "@/lib/quote";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { requireRole } from "@/lib/auth";
import { loadDashboard, type BreakdownMode } from "@/lib/dashboard-data";
import { getOrgProjects, getOrgDesignations, getAssignableEmployees } from "@/lib/org-data";
import { DatasetControls } from "@/components/dashboard/dataset-controls";
import type { UserStatus } from "@/lib/dashboard-data";
import { todayIso } from "@/lib/task-status";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { BreakdownPanel } from "@/components/dashboard/breakdown-panel";
import { ViewTabs } from "@/components/dashboard/view-controls";
import { OrgFilterControls } from "@/components/dashboard/org-filter-controls";
import { TableView } from "@/components/dashboard/table-view";
import { KanbanView } from "@/components/dashboard/kanban-view";
import { CalendarView } from "@/components/dashboard/calendar-view";

export default async function OrgDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["master_admin"]);
  const sp = await searchParams;

  const view = sp.view ?? "table";
  const filterMode = sp.filterMode ?? "all";
  const filterValue = sp.filterValue ?? "";
  const breakdownMode = (sp.breakdown ?? "project") as BreakdownMode;
  const monthIso = sp.month ?? todayIso().slice(0, 7);
  const userStatus = (["active", "inactive", "all"].includes(sp.userStatus ?? "") ? sp.userStatus : "active") as UserStatus;

  const quote = await getThoughtOfTheDay();
  const [data, projects, employees, designations] = await Promise.all([
    loadDashboard(appUser, {
      view,
      filterMode,
      filterValue,
      breakdownMode,
      monthIso,
      userStatus,
      withBreakdown: true,
    }),
    appUser.org_id ? getOrgProjects(appUser.org_id) : Promise.resolve([]),
    getAssignableEmployees(appUser, { includeInactive: true }),
    appUser.org_id ? getOrgDesignations(appUser.org_id) : Promise.resolve([]),
  ]);
  const {
    kpis,
    uniqueTaskTotal: uniqueTotal,
    completionPct,
    breakdownRows,
    taskGroups,
    tableTaskGroups,
    calendar,
  } = data;

  return (
    <div>
      <WelcomeBanner
        firstName={appUser.full_name.trim().split(/\s+/)[0]}
        quote={quote}
        links={[
          { href: "/users", label: "Users" },
          { href: "/reports", label: "Reports" },
          { href: "/task-management", label: "Task Management" },
          { href: "/org-settings", label: "Organization Settings" },
        ]}
      />
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5.5">
        <div>
          <div className="text-[22px] font-bold text-text-main">Organization Dashboard</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            All tasks across your organization
          </div>
        </div>
        <div className="bg-panel-bg border border-panel-border rounded-[10px] px-5 py-3.5 min-w-[220px]">
          <div className="text-[11.5px] font-bold text-text-sub uppercase tracking-wide">
            Overall completion
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-[26px] font-extrabold text-text-main">{completionPct}%</div>
            <div className="text-xs text-text-faint">
              {kpis.completed} of {kpis.total} tasks
            </div>
          </div>
          <div className="h-1.5 bg-table-head-bg rounded mt-2.5 overflow-hidden">
            <div
              className="h-full bg-accent rounded"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      <KpiCards kpis={kpis} uniqueTaskTotal={uniqueTotal} />

      <BreakdownPanel
        rows={breakdownRows}
        mode={breakdownMode}
        showManager
        buildHref={(m) => {
          const p = new URLSearchParams({ view, filterMode, filterValue, breakdown: m, month: monthIso, userStatus });
          return `?${p.toString()}`;
        }}
      />

      <div className="flex items-center justify-between mb-4.5 flex-wrap gap-3">
        <ViewTabs view={view} />
        <div className="flex items-center gap-3 flex-wrap">
          <DatasetControls month={monthIso} userStatus={userStatus} />
          <OrgFilterControls
            filterMode={filterMode}
            filterValue={filterValue}
            projects={projects}
            employees={employees}
            designations={designations}
          />
        </div>
      </div>

      {view === "table" ? <TableView tasks={tableTaskGroups} /> : null}
      {view === "kanban" ? <KanbanView tasks={taskGroups} /> : null}
      {view === "calendar" ? (
        <CalendarView instances={calendar} monthIso={monthIso} />
      ) : null}
    </div>
  );
}
