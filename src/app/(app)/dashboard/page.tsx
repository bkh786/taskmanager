import { getThoughtOfTheDay } from "@/lib/quote";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadDashboard, type BreakdownMode } from "@/lib/dashboard-data";
import { getAssignableEmployees, getOrgProjects } from "@/lib/org-data";
import { todayIso } from "@/lib/task-status";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { BreakdownPanel } from "@/components/dashboard/breakdown-panel";
import { ViewTabs, FilterControls } from "@/components/dashboard/view-controls";
import { TableView } from "@/components/dashboard/table-view";
import { KanbanView } from "@/components/dashboard/kanban-view";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { DatasetControls } from "@/components/dashboard/dataset-controls";
import type { UserStatus } from "@/lib/dashboard-data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["reporting_manager", "user"]);
  const sp = await searchParams;

  const view = sp.view ?? "table";
  const filterMode = sp.filterMode ?? "all";
  const filterValue = sp.filterValue ?? "";
  const breakdownMode = (sp.breakdown ?? "project") as BreakdownMode;
  const monthIso = sp.month ?? todayIso().slice(0, 7);
  const userStatus = (["active", "inactive", "all"].includes(sp.userStatus ?? "") ? sp.userStatus : "active") as UserStatus;

  const isManager = appUser.system_role === "reporting_manager";

  const quote = await getThoughtOfTheDay();
  const [data, employees, projects] = await Promise.all([
    loadDashboard(appUser, {
      view,
      filterMode: isManager ? filterMode : "all",
      filterValue: isManager ? filterValue : "",
      breakdownMode,
      monthIso,
      userStatus,
      withBreakdown: isManager,
    }),
    isManager ? getAssignableEmployees(appUser, { includeInactive: true }) : Promise.resolve([]),
    isManager && appUser.org_id ? getOrgProjects(appUser.org_id) : Promise.resolve([]),
  ]);
  const { kpis, uniqueTaskTotal, completionPct, breakdownRows, taskGroups, tableTaskGroups, calendar } =
    data;

  return (
    <div>
      <WelcomeBanner
        firstName={appUser.full_name.trim().split(/\s+/)[0]}
        quote={quote}
        links={
          isManager
            ? [
                { href: "/users", label: "Users" },
                { href: "/task-management", label: "Task Management" },
                { href: "/reports", label: "Reports" },
              ]
            : [{ href: "/reports", label: "My Reports" }]
        }
      />
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5.5">
        <div>
          <div className="text-[22px] font-bold text-text-main">Dashboard</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            {isManager ? "Your team's tasks" : "Your assigned tasks"}
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

      {isManager ? <KpiCards kpis={kpis} uniqueTaskTotal={uniqueTaskTotal} /> : null}

      {isManager ? (
        <BreakdownPanel
          rows={breakdownRows}
          mode={breakdownMode}
          buildHref={(m) => {
            const p = new URLSearchParams({ view, filterMode, filterValue, breakdown: m, month: monthIso, userStatus });
            return `?${p.toString()}`;
          }}
        />
      ) : null}

      <div className="flex items-center justify-between mb-4.5 flex-wrap gap-3">
        <ViewTabs view={view} />
        <div className="flex items-center gap-2 flex-wrap">
          <DatasetControls month={monthIso} userStatus={userStatus} availableMonths={data.availableMonths} showStatus={isManager} />
          {isManager ? (
            <FilterControls
              filterMode={filterMode}
              filterValue={filterValue}
              employees={employees}
              projects={projects}
            />
          ) : null}
          {isManager ? (
            <Link
              href="/task-management?tab=upload"
              className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] font-semibold whitespace-nowrap"
            >
              Bulk upload
            </Link>
          ) : null}
          {isManager ? <CreateTaskModal employees={employees.filter((e) => e.is_active)} /> : null}
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
