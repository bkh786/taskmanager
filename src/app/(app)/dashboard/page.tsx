import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  getDashboardInstances,
  computeKpis,
  computeBreakdown,
  groupInstancesByTask,
  uniqueTaskCount,
  type BreakdownMode,
} from "@/lib/dashboard-data";
import { getAssignableEmployees, getOrgProjects } from "@/lib/org-data";
import { todayIso } from "@/lib/task-status";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { BreakdownPanel } from "@/components/dashboard/breakdown-panel";
import { ViewTabs, FilterControls } from "@/components/dashboard/view-controls";
import { TableView } from "@/components/dashboard/table-view";
import { KanbanView } from "@/components/dashboard/kanban-view";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";

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

  const isManager = appUser.system_role === "reporting_manager";

  const [allInstances, employees, projects] = await Promise.all([
    getDashboardInstances(appUser),
    isManager ? getAssignableEmployees(appUser) : Promise.resolve([]),
    isManager && appUser.org_id ? getOrgProjects(appUser.org_id) : Promise.resolve([]),
  ]);

  let instances = allInstances;
  if (isManager) {
    if (filterMode === "employee" && filterValue) {
      instances = instances.filter((i) => i.assignee_id === filterValue);
    } else if (filterMode === "project" && filterValue) {
      const projectName = projects.find((p) => p.id === filterValue)?.name;
      instances = instances.filter((i) => i.project_name === projectName);
    }
  }

  const kpis = computeKpis(instances);
  const taskGroups = groupInstancesByTask(instances);
  const uniqueTotal = uniqueTaskCount(instances);
  const breakdownRows = isManager ? computeBreakdown(instances, breakdownMode) : [];
  const completionPct = kpis.total ? Math.round((kpis.completed / kpis.total) * 100) : 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-5.5">
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

      {isManager ? <KpiCards kpis={kpis} uniqueTaskTotal={uniqueTotal} /> : null}

      {isManager ? (
        <BreakdownPanel
          rows={breakdownRows}
          mode={breakdownMode}
          buildHref={(m) => {
            const p = new URLSearchParams({ view, filterMode, filterValue, breakdown: m });
            return `?${p.toString()}`;
          }}
        />
      ) : null}

      <div className="flex items-center justify-between mb-4.5 flex-wrap gap-3">
        <ViewTabs view={view} />
        <div className="flex items-center gap-2">
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
              href="/bulk-upload"
              className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] font-semibold whitespace-nowrap"
            >
              Bulk upload
            </Link>
          ) : null}
          {isManager ? <CreateTaskModal employees={employees} /> : null}
        </div>
      </div>

      {view === "table" ? <TableView tasks={taskGroups} /> : null}
      {view === "kanban" ? <KanbanView tasks={taskGroups} /> : null}
      {view === "calendar" ? (
        <CalendarView instances={instances} monthIso={monthIso} />
      ) : null}
    </div>
  );
}
