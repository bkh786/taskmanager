/** Single source of truth for the bulk-user-upload template's columns. */
export const USER_TEMPLATE_COLUMNS = [
  "org_code",
  "full_name",
  "email",
  "password",
  "role",
  "project",
  "designation",
  "reports_to_email",
] as const;

export function buildUserTemplateRow(orgCode: string) {
  return {
    org_code: orgCode,
    full_name: "Jordan Blake",
    email: "jordan.blake@acme.com",
    password: "ChangeMe123",
    role: "user",
    project: "Website Revamp",
    designation: "",
    reports_to_email: "",
  };
}

export const USER_TEMPLATE_NOTES = [
  "org_code: required — must match the organization code shown above. Do not change it.",
  "full_name, email, password: required. Password must be at least 8 characters.",
  "role: master_admin, reporting_manager, or user.",
  "project, designation: optional — must exactly match an existing name in User Management, or the row is skipped.",
  "reports_to_email: optional — the email of an existing user in this organization.",
];
