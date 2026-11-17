// Shared (server + client) definitions for notifications.

export type NotifLevel = "info" | "critical";

export type NotificationRow = {
  id: string;
  org_id: string | null;
  user_id: string;
  level: NotifLevel;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  source: string;
  ref_id: string | null;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
};

export const NOTIF_COLUMNS =
  "id, org_id, user_id, level, kind, title, body, link, source, ref_id, created_at, read_at, acknowledged_at";

export type RuleKind = "task_completed" | "task_assigned" | "task_overdue";

export const RULE_KINDS: { kind: RuleKind; title: string; help: string; multi: boolean }[] = [
  {
    kind: "task_completed",
    title: "When a task is completed",
    help: "A general (low-importance) update, for example telling the task's creator that the team finished it.",
    multi: false,
  },
  {
    kind: "task_assigned",
    title: "When a task is assigned",
    help: "Tells the assignee as soon as someone gives them a task.",
    multi: false,
  },
  {
    kind: "task_overdue",
    title: "When a task is overdue",
    help: "Critical alerts that escalate. Add a step for each stage, for example day 1 the assignee, day 3 their manager, day 7 the admins.",
    multi: true,
  },
];

export type Audience =
  | { scope: "all" }
  | { scope: "roles"; roles: string[] }
  | { scope: "projects"; project_ids: string[] }
  | { scope: "users"; user_ids: string[] }
  // Platform announcements: which organizations, and whether only their admins get it.
  | { scope: "orgs"; org_ids: string[] | null; admins_only: boolean };

export const AUDIENCE_ROLES: { value: string; label: string }[] = [
  { value: "master_admin", label: "Org admins" },
  { value: "reporting_manager", label: "Reporting managers" },
  { value: "user", label: "Employees" },
];
