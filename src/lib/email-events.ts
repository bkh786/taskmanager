// Shared (server + client) definitions of the emails the app can send, their
// built-in default wording, and the template rendering used for them.

export type EmailEventId =
  | "user_created"
  | "password_reset"
  | "task_assigned"
  | "task_completed"
  | "date_change_requested"
  | "reminder_upcoming"
  | "reminder_delayed"
  | "reminder_missed";

export type EmailVariable = { key: string; description: string };

export type EmailEventDef = {
  id: EmailEventId;
  label: string;
  description: string;
  group: "Accounts" | "Tasks" | "Reminders";
  variables: EmailVariable[];
  defaultSubject: string;
  defaultBody: string;
};

const ORG: EmailVariable = { key: "org_name", description: "Your organization's name" };

export const EMAIL_EVENTS: EmailEventDef[] = [
  {
    id: "user_created",
    label: "New user welcome",
    description: "Sent to a person when an account is created for them.",
    group: "Accounts",
    variables: [
      { key: "user_name", description: "The new user's full name" },
      { key: "user_email", description: "Their sign-in email" },
      { key: "employee_code", description: "Their employee code" },
      { key: "role", description: "Their role" },
      { key: "login_url", description: "Link to the sign-in page" },
      { key: "password", description: "The initial password set for them" },
      { key: "set_password_link", description: "One-time link to choose their own password" },
      ORG,
    ],
    defaultSubject: "Welcome to {{org_name}} Task Manager",
    defaultBody:
      "Hi {{user_name}},\n\nAn account has been created for you on {{org_name}}'s Task Manager.\n\nSign in at {{login_url}}\nUser name: {{user_email}}\nPassword: {{password}}\n\nPlease change your password after signing in (profile menu, top right). If you'd rather choose your own now, use this link (valid for one hour):\n{{set_password_link}}",
  },
  {
    id: "password_reset",
    label: "Password reset",
    description: "Sent when someone uses \"Forgot password?\" on the sign-in page.",
    group: "Accounts",
    variables: [
      { key: "user_name", description: "The user's full name" },
      { key: "reset_link", description: "One-time link to set a new password" },
      ORG,
    ],
    defaultSubject: "Reset your {{org_name}} password",
    defaultBody:
      "Hi {{user_name}},\n\nWe received a request to reset your password. Use this link to choose a new one (valid for one hour):\n{{reset_link}}\n\nIf you didn't ask for this, you can ignore this email.",
  },
  {
    id: "task_assigned",
    label: "Task assigned",
    description: "Sent to the assignee when a task is created for them.",
    group: "Tasks",
    variables: [
      { key: "assignee_name", description: "Who the task is assigned to" },
      { key: "task_name", description: "Task name" },
      { key: "description", description: "Task description" },
      { key: "start_date", description: "First due date" },
      { key: "schedule", description: "One-time, or the recurrence (e.g. Daily)" },
      { key: "assigned_by", description: "Who created the task" },
      { key: "task_link", description: "Link to the task" },
      ORG,
    ],
    defaultSubject: "New task assigned: {{task_name}}",
    defaultBody:
      "Hi {{assignee_name}},\n\n{{assigned_by}} assigned you a task: {{task_name}}\nSchedule: {{schedule}}, starting {{start_date}}.\n\n{{description}}\n\nOpen it here: {{task_link}}",
  },
  {
    id: "task_completed",
    label: "Task completed",
    description: "Sent to the task's creator when the assignee marks it complete.",
    group: "Tasks",
    variables: [
      { key: "creator_name", description: "Who created the task" },
      { key: "assignee_name", description: "Who completed it" },
      { key: "task_name", description: "Task name" },
      { key: "due_date", description: "The occurrence's due date" },
      { key: "comment", description: "The assignee's completion comment" },
      { key: "task_link", description: "Link to the task and its proof" },
      ORG,
    ],
    defaultSubject: "Task completed: {{task_name}}",
    defaultBody:
      "Hi {{creator_name}},\n\n{{assignee_name}} marked \"{{task_name}}\" (due {{due_date}}) as complete.\n\nComment: {{comment}}\n\nView the proof: {{task_link}}",
  },
  {
    id: "date_change_requested",
    label: "Date change requested",
    description: "Sent to the task's creator when an assignee proposes a new due date.",
    group: "Tasks",
    variables: [
      { key: "creator_name", description: "Who created the task" },
      { key: "assignee_name", description: "Who is asking" },
      { key: "task_name", description: "Task name" },
      { key: "due_date", description: "Current due date" },
      { key: "proposed_date", description: "The proposed new date" },
      { key: "task_link", description: "Link to the task" },
      ORG,
    ],
    defaultSubject: "Date change requested: {{task_name}}",
    defaultBody:
      "Hi {{creator_name}},\n\n{{assignee_name}} asked to move \"{{task_name}}\" (currently due {{due_date}}) to {{proposed_date}}.\n\nNothing has changed automatically. Edit or transfer the task if you agree: {{task_link}}",
  },
  {
    id: "reminder_upcoming",
    label: "Reminder: due today",
    description: "Sent to the assignee on the day a task is due, at your daily reminder time.",
    group: "Reminders",
    variables: [
      { key: "assignee_name", description: "The assignee's name" },
      { key: "task_name", description: "Task name" },
      { key: "due_date", description: "Due date" },
      { key: "task_link", description: "Link to the task" },
      ORG,
    ],
    defaultSubject: "Reminder: \"{{task_name}}\" is due today",
    defaultBody:
      "Hi {{assignee_name}},\n\n\"{{task_name}}\" is due today ({{due_date}}).\n\nComplete it here: {{task_link}}",
  },
  {
    id: "reminder_delayed",
    label: "Reminder: overdue",
    description: "Sent to the assignee while a task is up to 2 days overdue.",
    group: "Reminders",
    variables: [
      { key: "assignee_name", description: "The assignee's name" },
      { key: "task_name", description: "Task name" },
      { key: "due_date", description: "The original due date" },
      { key: "days_overdue", description: "How many days overdue" },
      { key: "task_link", description: "Link to the task" },
      ORG,
    ],
    defaultSubject: "Overdue: \"{{task_name}}\" was due {{due_date}}",
    defaultBody:
      "Hi {{assignee_name}},\n\n\"{{task_name}}\" was due on {{due_date}} and is {{days_overdue}} day(s) overdue.\n\nComplete it here: {{task_link}}",
  },
  {
    id: "reminder_missed",
    label: "Reminder: long overdue",
    description: "Sent to the assignee once a task is 3 or more days overdue.",
    group: "Reminders",
    variables: [
      { key: "assignee_name", description: "The assignee's name" },
      { key: "task_name", description: "Task name" },
      { key: "due_date", description: "The original due date" },
      { key: "days_overdue", description: "How many days overdue" },
      { key: "task_link", description: "Link to the task" },
      ORG,
    ],
    defaultSubject: "Still not done: \"{{task_name}}\" was due {{due_date}}",
    defaultBody:
      "Hi {{assignee_name}},\n\n\"{{task_name}}\" is now {{days_overdue}} days overdue (due {{due_date}}).\n\nPlease complete it or ask your manager to reschedule: {{task_link}}",
  },
];

export const ROLE_LABEL: Record<string, string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

export const EMAIL_EVENT_IDS = EMAIL_EVENTS.map((e) => e.id);

export function getEventDef(id: string): EmailEventDef | undefined {
  return EMAIL_EVENTS.find((e) => e.id === id);
}

export type Vars = Record<string, string | number | null | undefined>;

function substitute(template: string, vars: Vars): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Subjects are single-line plain text: also strips CR/LF so a value can't inject headers. */
export function renderSubject(template: string, vars: Vars): string {
  return substitute(template, vars).replace(/[\r\n]+/g, " ").trim().slice(0, 300);
}

export function renderBodyText(template: string, vars: Vars, signature?: string | null): string {
  const body = substitute(template, vars).replace(/\n{3,}/g, "\n\n").trim();
  return signature?.trim() ? `${body}\n\n-- \n${signature.trim()}` : body;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain-text template -> safe HTML: everything is escaped, then bare URLs become links. */
export function renderBodyHtml(template: string, vars: Vars, signature?: string | null): string {
  const text = renderBodyText(template, vars, signature);
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}">${url}</a>`
  );
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937">${linked.replace(/\n/g, "<br>")}</div>`;
}

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export function isValidEmail(s: string): boolean {
  return s.length <= 254 && EMAIL_RE.test(s);
}

/** "a@x.com, b@y.com; c@z.com" -> validated, de-duplicated list (max 10). */
export function parseEmailList(input: string | null | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  for (const part of input.split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (e && isValidEmail(e)) seen.add(e);
  }
  return [...seen].slice(0, 10);
}
