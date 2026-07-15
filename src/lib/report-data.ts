import "server-only";
import { createClient } from "@/lib/supabase/server";
import { delayDays } from "@/lib/task-status";

export type ReportRow = {
  instanceId: string;
  taskName: string;
  assignedDate: string;
  dueDate: string;
  completedDate: string | null;
  delayInDays: number;
  status: string;
  evidencePath: string;
  comment: string;
  assigneeName: string;
  designation: string;
  project: string;
  dateOfJoining: string;
};

type RawRow = {
  id: string;
  created_at: string | null;
  due_date: string;
  completed_at: string | null;
  status: string | null;
  attachment_url: string | null;
  comment: string | null;
  task: { task_name: string } | null;
  assignee: {
    full_name: string;
    date_of_joining: string | null;
    designation: { name: string } | null;
    project: { name: string } | null;
  } | null;
};

// Scoping is enforced entirely by RLS on task_instances/tasks (org
// isolation), same as the dashboard queries -- no caller-specific filtering
// needed here.
export async function getReportRows(): Promise<ReportRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_instances")
    .select(
      `id, created_at, due_date, completed_at, status, attachment_url, comment,
       task:tasks!task_instances_task_id_fkey ( task_name ),
       assignee:app_users!task_instances_assignee_id_fkey (
         full_name, date_of_joining,
         designation:designations(name),
         project:projects(name)
       )`
    )
    .order("due_date", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as RawRow[])
    .filter((r) => r.task && r.assignee)
    .map((r) => ({
      instanceId: r.id,
      taskName: r.task!.task_name,
      assignedDate: r.created_at ?? "",
      dueDate: r.due_date,
      completedDate: r.completed_at,
      delayInDays: delayDays(r.due_date, r.completed_at),
      status: r.status ?? "pending",
      evidencePath: r.attachment_url ?? "",
      comment: r.comment ?? "",
      assigneeName: r.assignee!.full_name,
      designation: r.assignee!.designation?.name ?? "",
      project: r.assignee!.project?.name ?? "",
      dateOfJoining: r.assignee!.date_of_joining ?? "",
    }));
}
