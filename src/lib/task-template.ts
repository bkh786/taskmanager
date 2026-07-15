/** Single source of truth for the bulk-upload template's columns. */
export const TEMPLATE_COLUMNS = [
  "task_name",
  "description",
  "assignee_emails",
  "recurrence_kind",
  "recurrence_interval",
  "start_date",
  "end_date",
  "reminder_enabled",
] as const;

export const TEMPLATE_EXAMPLE_ROW = {
  task_name: "Weekly status report",
  description: "Summarize progress for the week",
  assignee_emails: "jordan.blake@acme.com, ava.chen@acme.com",
  recurrence_kind: "weekly",
  recurrence_interval: 1,
  start_date: "2026-08-01",
  end_date: "",
  reminder_enabled: "true",
};

export const TEMPLATE_NOTES = [
  "task_name: required.",
  "description: optional.",
  "assignee_emails: required — one or more employee emails, separated by commas. One task is created per assignee.",
  "recurrence_kind: one_time, daily, weekly, or monthly. Leave blank for one_time.",
  "recurrence_interval: e.g. 2 with recurrence_kind=weekly means every 2 weeks. Leave blank for 1.",
  "start_date: required, format YYYY-MM-DD.",
  "end_date: optional, format YYYY-MM-DD. Leave blank for no end date.",
  "reminder_enabled: true or false. Leave blank for true.",
];
