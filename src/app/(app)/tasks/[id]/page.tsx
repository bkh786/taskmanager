import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAttachmentSignedUrl } from "@/lib/attachments";
import { fmtDate } from "@/lib/task-status";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CompleteForm } from "@/components/dashboard/complete-form";
import { DateChangeForm } from "@/components/dashboard/date-change-form";
import { ManagerActions } from "@/components/dashboard/manager-actions";
import { getAssignableEmployees } from "@/lib/org-data";
import type { DashboardInstance } from "@/lib/dashboard-data";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_instances")
    .select(
      `id, task_id, due_date, status, completed_at, comment, attachment_url,
       assignee_id, original_assignee_id,
       task:tasks!task_instances_task_id_fkey ( task_name, description, is_recurring, reminder_enabled ),
       assignee:app_users!task_instances_assignee_id_fkey ( full_name, system_role, project:projects(name) )`
    )
    .eq("id", id)
    .single();

  if (error || !data || !data.task || !data.assignee) notFound();

  const instance: DashboardInstance = {
    id: data.id,
    task_id: data.task_id!,
    due_date: data.due_date,
    status: data.status,
    completed_at: data.completed_at,
    comment: data.comment,
    attachment_url: data.attachment_url,
    assignee_id: data.assignee_id,
    original_assignee_id: data.original_assignee_id,
    task_name: data.task.task_name,
    description: data.task.description,
    is_recurring: !!data.task.is_recurring,
    reminder_enabled: !!data.task.reminder_enabled,
    assignee_name: data.assignee.full_name,
    assignee_role: data.assignee.system_role,
    project_name: (data.assignee.project as { name: string } | null)?.name ?? null,
  };

  const isCompleted = instance.status === "completed";
  const isRemoved = instance.status === "removed";
  const canComplete = !isCompleted && !isRemoved && instance.assignee_id === appUser.id;
  const isManager =
    appUser.system_role === "master_admin" || appUser.system_role === "reporting_manager";
  const attachmentUrl = await getAttachmentSignedUrl(instance.attachment_url);
  const employees = isManager ? await getAssignableEmployees(appUser) : [];

  return (
    <div className="max-w-[920px]">
      <Link href="/dashboard" className="text-[13px] text-text-sub mb-4 inline-block">
        ← Back to Dashboard
      </Link>
      <div className="grid grid-cols-[1.4fr_1fr] gap-5 items-start">
        <div className="bg-panel-bg border border-panel-border rounded-[10px] p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[19px] font-bold text-text-main">
              {instance.task_name}
            </div>
            <StatusBadge instance={instance} />
          </div>
          {instance.description ? (
            <div className="text-[13.5px] text-text-body leading-relaxed mt-3">
              {instance.description}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3.5 mt-5.5 pt-4.5 border-t border-row-hover-border">
            <Field label="Assignee" value={instance.assignee_name} />
            <Field label="Project" value={instance.project_name ?? "—"} />
            <Field label="Due date" value={fmtDate(instance.due_date)} />
            <Field
              label="Completed"
              value={instance.completed_at ? fmtDate(instance.completed_at) : "—"}
            />
          </div>

          {isCompleted && attachmentUrl ? (
            <div className="mt-4">
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-accent font-semibold"
              >
                View proof of completion →
              </a>
              {instance.comment ? (
                <div className="text-[13px] text-text-body mt-2">
                  <span className="font-semibold">Comment: </span>
                  {instance.comment}
                </div>
              ) : null}
            </div>
          ) : null}

          {!isCompleted && !isRemoved && instance.assignee_id === appUser.id ? (
            <div className="mt-5">
              <DateChangeForm instanceId={instance.id} />
            </div>
          ) : null}

          {isManager && !isRemoved ? (
            <ManagerActions
              instanceId={instance.id}
              currentAssigneeId={instance.assignee_id}
              employees={employees}
            />
          ) : null}
        </div>

        {canComplete ? (
          <CompleteForm instanceId={instance.id} />
        ) : (
          <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
            <div className="text-[13.5px] text-text-sub">
              {isRemoved
                ? "This task instance has been removed."
                : isCompleted
                  ? "This task is already completed."
                  : "Only the assignee can mark this task complete."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-text-faint uppercase">{label}</div>
      <div className="text-[13.5px] text-text-main mt-0.5">{value}</div>
    </div>
  );
}
