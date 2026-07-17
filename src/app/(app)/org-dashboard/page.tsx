import { requireRole } from "@/lib/auth";
import {
  getDashboardInstances,
  computeKpis,
  computeBreakdown,
  groupInstancesByTask,
  uniqueTaskCount,
  type BreakdownMode,
} from "@/lib/dashboard-data";
import { getOrgProjects } from "@/lib/org-data";
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

  const [allInstances, projects] = await Promise.all([
    getDashboardInstances(appUser),
    appUser.org_id ? getOrgProjects(appUser.org_id) : Promise.resolve([]),
  ]);

  let instances = allInstances;
  if (filterMode === "project" && filterValue) {
    const projectName = projects.find((p) => p.id === filterValue)?.name;
    instances = instances.filter((i) => i.project_name === projectName);
  } else if (filterMode === "role" && filterValue) {
    instances = instances.filter((i) => i.assignee_role === filterValue);
  }

  const kpis = computeKpis(instances);
  const taskGroups = groupInstancesByTask(instances);
  const uniqueTotal = uniqueTaskCount(instances);
  const breakdownRows = computeBreakdown(instances, breakdownMode);
  const completionPct = kpis.total ? Math.round((kpis.completed / kpis.total) * 100) : 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-5.5">
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
          const p = new URLSearchParams({ view, filterMode, filterValue, breakdown: m });
          return `?${p.toString()}`;
        }}
      />

      <div className="flex items-center justify-between mb-4.5 flex-wrap gap-3">
        <ViewTabs view={view} />
        <OrgFilterControls filterMode={filterMode} filterValue={filterValue} projects={projects} />
      </div>

      {view === "table" ? <TableView tasks={taskGroups} /> : null}
      {view === "kanban" ? <KanbanView tasks={taskGroups} /> : null}
      {view === "calendar" ? (
        <CalendarView instances={instances} monthIso={monthIso} />
      ) : null}
    </div>
  );
}
