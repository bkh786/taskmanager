import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAssignableEmployees, getUserActiveTasks, getOrgProjects } from "@/lib/org-data";
import { todayIso } from "@/lib/task-status";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { SourceSelect } from "@/components/bulk-copy/source-select";
import { CopyForm } from "@/components/bulk-copy/copy-form";
import { UploadForm } from "@/components/bulk-upload/upload-form";
import { BulkRemoval, type RemovalRow } from "@/components/task-management/bulk-removal";

const TABS = [
  { key: "create", label: "Create task" },
  { key: "copy", label: "Bulk copy" },
  { key: "upload", label: "Bulk upload" },
  { key: "remove", label: "Bulk removal" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const REMOVAL_CAP = 1500;

export default async function TaskManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "create";

  return (
    <div className="max-w-[1100px]">
      <div className="text-[22px] font-bold text-text-main mb-0.5">Task Management</div>
      <div className="text-[13.5px] text-text-sub mb-4">
        Create, copy, upload and remove tasks for your team
      </div>

      <div className="flex gap-1 border-b border-panel-border mb-5 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/task-management?tab=${t.key}`}
              className="px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap -mb-px border-b-2"
              style={{
                borderColor: active ? "var(--accent)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-sub)",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "create" ? <CreateTab appUserId={appUser.id} /> : null}
      {tab === "copy" ? <CopyTab source={sp.source ?? ""} /> : null}
      {tab === "upload" ? <UploadForm /> : null}
      {tab === "remove" ? <RemoveTab emp={sp.emp ?? ""} proj={sp.proj ?? ""} /> : null}
    </div>
  );
}

async function CreateTab({ appUserId }: { appUserId: string }) {
  void appUserId;
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  const employees = await getAssignableEmployees(appUser);
  return <CreateTaskModal employees={employees} inline />;
}

async function CopyTab({ source }: { source: string }) {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  const employees = await getAssignableEmployees(appUser);
  // The id arrives via the URL: only accept someone this person may manage.
  const sourceId = employees.some((e) => e.id === source) ? source : "";
  const tasks = sourceId ? await getUserActiveTasks(sourceId) : [];
  const targetCandidates = employees.filter((e) => e.id !== sourceId);
  return (
    <div>
      <div className="mb-5">
        <label className="text-xs font-semibold text-text-sub block mb-1.5">Source user</label>
        <SourceSelect employees={employees} sourceId={sourceId} />
      </div>
      {sourceId ? (
        <CopyForm key={sourceId} sourceId={sourceId} tasks={tasks} targetCandidates={targetCandidates} />
      ) : (
        <div className="text-[13px] text-text-faint">Choose a source user to see their tasks.</div>
      )}
    </div>
  );
}

async function RemoveTab({ emp, proj }: { emp: string; proj: string }) {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  const supabase = await createClient();
  const employees = await getAssignableEmployees(appUser, { includeInactive: true });
  const projects = appUser.org_id ? await getOrgProjects(appUser.org_id) : [];
  const byId = new Map(employees.map((e) => [e.id, e]));

  // Only people this person may manage; ids arrive via the URL.
  let ids: string[] = [];
  if (emp && byId.has(emp)) ids = [emp];
  else if (proj) ids = employees.filter((e) => e.project_id === proj).map((e) => e.id);

  const today = todayIso();
  const rows: RemovalRow[] = [];
  let truncated = false;
  for (let i = 0; i < ids.length && rows.length < REMOVAL_CAP; i += 80) {
    const { data, error } = await supabase
      .from("task_instances")
      .select("id, due_date, assignee_id, task:tasks!task_instances_task_id_fkey(task_name, is_recurring, recurrence_kind)")
      .in("assignee_id", ids.slice(i, i + 80))
      .eq("removed", false)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(REMOVAL_CAP);
    if (error) throw error;
    for (const r of data ?? []) {
      const e = r.assignee_id ? byId.get(r.assignee_id) : undefined;
      const task = r.task as { task_name: string; is_recurring: boolean | null; recurrence_kind: string | null } | null;
      if (!e || !task) continue;
      rows.push({
        id: r.id,
        taskName: task.task_name,
        assigneeName: e.full_name,
        assigneeActive: e.is_active,
        project: e.project_name ?? "—",
        dueDate: r.due_date,
        kind: r.due_date < today ? "Overdue" : "Due",
        recurring: task.is_recurring ? `Repeats ${task.recurrence_kind}` : "One time",
      });
    }
  }
  if (rows.length >= REMOVAL_CAP) truncated = true;
  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <BulkRemoval
      rows={rows.slice(0, REMOVAL_CAP)}
      employees={employees.map((e) => ({ id: e.id, full_name: e.full_name, is_active: e.is_active }))}
      projects={projects}
      emp={emp}
      proj={proj}
      truncated={truncated}
    />
  );
}
