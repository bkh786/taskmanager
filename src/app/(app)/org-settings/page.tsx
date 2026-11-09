import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/org-settings/settings-form";
import { NotificationTemplatesForm } from "@/components/org-settings/notification-templates-form";
import { getOrgSettings, getSavedTemplates } from "@/lib/org-settings-data";
import { LogoUploadForm } from "@/components/org-settings/logo-upload-form";
import { LoginLinkForm } from "@/components/org-settings/login-link-form";
import { NameListManager } from "@/components/users/projects-designations-panel";
import { createProject, createDesignation } from "@/app/(app)/users/actions";
import { getOrgProjects, getOrgDesignations } from "@/lib/org-data";

const TABS = [
  { key: "general", label: "General" },
  { key: "projects", label: "Projects" },
  { key: "designations", label: "Designations" },
  { key: "roles", label: "Roles" },
  { key: "email", label: "Email templates" },
  { key: "branding", label: "Branding & login" },
] as const;

const ROLES = [
  { name: "Employee", permissions: "View & complete own tasks" },
  {
    name: "Reporting Manager",
    permissions: "Manages users, tasks, and reports within their reporting chain",
  },
  { name: "Org Admin", permissions: "Full control within the organization" },
];

export default async function OrgSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["master_admin"]);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "general";
  const supabase = await createClient();

  const [org, templates] = await Promise.all([
    getOrgSettings(appUser.org_id ?? ""),
    getSavedTemplates(appUser.org_id ?? ""),
  ]);
  if (!org) {
    return <div className="text-[13.5px] text-danger">Could not load organization.</div>;
  }

  const { count: employeeCount } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("org_id", appUser.org_id ?? "");

  const [projects, designations] =
    tab === "projects" || tab === "designations"
      ? await Promise.all([
          getOrgProjects(appUser.org_id ?? ""),
          getOrgDesignations(appUser.org_id ?? ""),
        ])
      : [[], []];

  return (
    <div className="max-w-[920px]">
      <div className="text-[22px] font-bold text-text-main mb-0.5">
        Organization Settings
      </div>
      <div className="text-[13.5px] text-text-sub mb-4">
        Company profile, projects, designations, roles, and email configuration
      </div>

      <div className="flex gap-1 border-b border-panel-border mb-5 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/org-settings?tab=${t.key}`}
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

      {tab === "general" ? <SettingsForm org={org} /> : null}

      {tab === "projects" ? (
        <NameListManager
          title="Projects"
          items={projects}
          action={createProject}
          placeholder="New project name"
          emptyText="No projects yet."
        />
      ) : null}

      {tab === "designations" ? (
        <NameListManager
          title="Designations"
          items={designations}
          action={createDesignation}
          placeholder="New designation name"
          emptyText="No designations yet."
        />
      ) : null}

      {tab === "roles" ? (
        <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
          <div className="flex items-center justify-between mb-3.5">
            <div className="text-[14.5px] font-bold text-text-main">Roles</div>
            <div className="text-[12.5px] text-text-sub">
              {employeeCount ?? 0} employees total
            </div>
          </div>
          {ROLES.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between py-2.5 border-b border-row-hover-border last:border-b-0"
            >
              <div className="text-[13.5px] font-semibold text-text-main">{r.name}</div>
              <div className="text-[12.5px] text-text-sub">{r.permissions}</div>
            </div>
          ))}
          <div className="text-[12px] text-text-faint mt-3">
            These are the built-in roles; each carries fixed permissions across the app.
          </div>
          <Link
            href="/users"
            className="inline-block mt-3.5 text-[13px] font-semibold text-accent"
          >
            Manage employee list →
          </Link>
        </div>
      ) : null}

      {tab === "email" ? <NotificationTemplatesForm templates={templates} /> : null}

      {tab === "branding" ? (
        <div className="flex flex-col gap-5">
          <LogoUploadForm logoUrl={org.logo_url} />
          <LoginLinkForm
            domain={org.custom_login_domain}
            slug={org.slug}
            defaultDomain={process.env.NEXT_PUBLIC_APP_URL ?? ""}
          />
        </div>
      ) : null}
    </div>
  );
}
