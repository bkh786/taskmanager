// Emails the platform sends to tenants (billing, plans, offers): same shape
// and template syntax as the task emails in email-events.ts.

export type PlatformEventId =
  | "billing_reminder"
  | "invoice_generated"
  | "payment_received"
  | "payment_overdue"
  | "plan_changed"
  | "offer";

export type PlatformEventDef = {
  id: PlatformEventId;
  label: string;
  description: string;
  group: "Billing" | "Plans" | "Offers";
  variables: { key: string; description: string }[];
  defaultSubject: string;
  defaultBody: string;
};

const ORG = { key: "org_name", description: "The tenant's organization name" };
const ADMIN = { key: "admin_name", description: "The recipient's name" };
const PLAN = { key: "plan_name", description: "Plan name" };
const CYCLE = { key: "billing_cycle", description: "Billing cycle (Monthly, Annual, …)" };

export const PLATFORM_EVENTS: PlatformEventDef[] = [
  {
    id: "billing_reminder",
    label: "Billing cycle reminder",
    description: "Sent to the platform owner and the tenant's org admin on the first day of every billing cycle.",
    group: "Billing",
    variables: [ADMIN, ORG, PLAN, CYCLE,
      { key: "cycle_start", description: "First day of the cycle" },
      { key: "cycle_end", description: "Last day of the cycle" },
      { key: "amount", description: "Amount due for the cycle" },
      { key: "invoice_number", description: "The invoice raised for this cycle" },
      { key: "due_date", description: "Payment due date" },
    ],
    defaultSubject: "Billing reminder: {{org_name}} – new {{billing_cycle}} cycle starts {{cycle_start}}",
    defaultBody:
      "Hi {{admin_name}},\n\nA new billing cycle begins today for {{org_name}}.\n\nPlan: {{plan_name}} ({{billing_cycle}})\nCycle: {{cycle_start}} to {{cycle_end}}\nAmount: {{amount}}\nInvoice: {{invoice_number}} (due {{due_date}})\n\nThe invoice has been emailed separately. Please arrange payment by the due date to avoid any interruption.",
  },
  {
    id: "invoice_generated",
    label: "Invoice",
    description: "Sent to the tenant's org admin when an invoice is generated automatically or manually.",
    group: "Billing",
    variables: [ADMIN, ORG, PLAN, CYCLE,
      { key: "invoice_number", description: "Invoice number" },
      { key: "issue_date", description: "Date issued" },
      { key: "due_date", description: "Payment due date" },
      { key: "period", description: "Period covered" },
      { key: "amount", description: "Total payable" },
      { key: "users", description: "Licensed user count" },
    ],
    defaultSubject: "Invoice {{invoice_number}} for {{org_name}} – {{amount}}",
    defaultBody:
      "Hi {{admin_name}},\n\nHere is your invoice for {{org_name}}.\n\nInvoice number: {{invoice_number}}\nIssued: {{issue_date}}\nDue: {{due_date}}\nPlan: {{plan_name}} ({{billing_cycle}})\nPeriod: {{period}}\nLicensed users: {{users}}\nAmount payable: {{amount}}\n\nPlease reply to this email with the payment reference once paid.",
  },
  {
    id: "payment_received",
    label: "Payment received",
    description: "Sent to the org admin when an invoice is marked paid.",
    group: "Billing",
    variables: [ADMIN, ORG, PLAN,
      { key: "invoice_number", description: "Invoice number" },
      { key: "amount", description: "Amount received" },
      { key: "paid_on", description: "Date received" },
      { key: "payment_reference", description: "Payment reference" },
    ],
    defaultSubject: "Payment received – {{invoice_number}}",
    defaultBody:
      "Hi {{admin_name}},\n\nWe have received your payment of {{amount}} for invoice {{invoice_number}} on {{paid_on}}.\nReference: {{payment_reference}}\n\nThank you for choosing us.",
  },
  {
    id: "payment_overdue",
    label: "Payment overdue",
    description: "Sent to the org admin (and platform owner) when an invoice passes its due date unpaid.",
    group: "Billing",
    variables: [ADMIN, ORG, PLAN,
      { key: "invoice_number", description: "Invoice number" },
      { key: "amount", description: "Amount outstanding" },
      { key: "due_date", description: "The original due date" },
    ],
    defaultSubject: "Payment overdue: {{invoice_number}} for {{org_name}}",
    defaultBody:
      "Hi {{admin_name}},\n\nInvoice {{invoice_number}} for {{org_name}} ({{amount}}) was due on {{due_date}} and has not been paid yet.\n\nPlease settle it at your earliest convenience to keep your service uninterrupted.",
  },
  {
    id: "plan_changed",
    label: "Plan or seats changed",
    description: "Sent to the org admin when their plan, billing cycle or user limit is changed.",
    group: "Plans",
    variables: [ADMIN, ORG, PLAN, CYCLE,
      { key: "max_users", description: "New user limit" },
      { key: "next_billing_date", description: "Next billing date" },
      { key: "change", description: "What changed" },
    ],
    defaultSubject: "Your plan has been updated – {{org_name}}",
    defaultBody:
      "Hi {{admin_name}},\n\nYour subscription for {{org_name}} has been updated.\n\n{{change}}\n\nPlan: {{plan_name}} ({{billing_cycle}})\nUser limit: {{max_users}}\nNext billing date: {{next_billing_date}}",
  },
  {
    id: "offer",
    label: "Offer / announcement",
    description: "Used when the platform owner sends an offer or announcement to tenants.",
    group: "Offers",
    variables: [ADMIN, ORG,
      { key: "offer_title", description: "Headline of the offer" },
      { key: "offer_details", description: "Offer details" },
    ],
    defaultSubject: "{{offer_title}}",
    defaultBody: "Hi {{admin_name}},\n\n{{offer_details}}\n\nReply to this email to take it up for {{org_name}}.",
  },
];

export function getPlatformEventDef(id: string): PlatformEventDef | undefined {
  return PLATFORM_EVENTS.find((e) => e.id === id);
}
