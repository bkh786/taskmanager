import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgProjects, getOrgDesignations } from "@/lib/org-data";
import { createProject, createDesignation, renameProject, renameDesignation } from "@/app/(app)/users/actions";
import { NameListManager } from "@/components/users/projects-designations-panel";
import { GeneralForm } from "./general-form";
import { SmtpSettingsForm, type OrgSettingsOrg } from "./settings-form";
import { EmailOptionsForm } from "./email-options-form";
import { NotificationTemplatesForm, type SavedTemplates } from "./notification-templates-form";
import { LogoUploadForm } from "./logo-upload-form";
import { LoginLinkForm } from "./login-link-form";
import { ThemeControls } from "@/components/theme-controls";

const ROLES = [
  { key: "user", name: "Employee", permissions: "View & complete own tasks" },
  {
    key: "reporting_manager",
    name: "Reporting Manager",
    permissions: "Manages users, tasks, and reports within their reporting chain",
  },
  { key: "master_admin", name: "Org Admin", permissions: "Full control within the organization" },
] as const;

const card = "bg-panel-bg border border-panel-border rounded-[10px] p-5.5";

export function GeneralSection({ org, orgId }: { org: OrgSettingsOrg; orgId?: string }) {
  return (
    <div className="flex flex-col gap-5">
      <GeneralForm name={org.name} timezone={org.timezone ?? "Asia/Kolkata"} orgId={orgId} />
      <LogoUploadForm logoUrl={org.logo_url} orgId={orgId} />
      <div className={card}>
        <div className="text-[14.5px] font-bold text-text-main mb-1">Theme</div>
        <div className="text-[12.5px] text-text-sub mb-3">
          Colour theme and dark mode for your own view.
        </div>
        <ThemeControls />
      </div>
      <LoginLinkForm
        domain={org.custom_login_domain}
        slug={org.slug}
        defaultDomain={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        orgId={orgId}
      />
    </div>
  );
}

export async function VariablesSection({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const [projects, designations, ...counts] = await Promise.all([
    getOrgProjects(orgId),
    getOrgDesignations(orgId),
    ...ROLES.map((r) =>
      supabase
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("system_role", r.key)
    ),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <NameListManager
        title="Projects / Departments"
        items={projects}
        createAction={createProject}
        renameAction={renameProject}
        placeholder="New project / department name"
        emptyText="No projects yet."
      />
      <NameListManager
        title="Designations"
        items={designations}
        createAction={createDesignation}
        renameAction={renameDesignation}
        placeholder="New designation name"
        emptyText="No designations yet."
      />
      <div className={card}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[14.5px] font-bold text-text-main">Roles</div>
          <div className="text-[12.5px] text-text-sub">{ROLES.length} roles</div>
        </div>
        {ROLES.map((r, i) => (
          <div
            key={r.key}
            className="flex items-center gap-4 py-2.5 border-b border-row-hover-border last:border-b-0"
          >
            <div className="w-[170px] text-[13.5px] font-semibold text-text-main">{r.name}</div>
            <div className="flex-1 text-[12.5px] text-text-sub">{r.permissions}</div>
            <div className="text-[12.5px] text-text-body whitespace-nowrap">
              {counts[i].count ?? 0} user(s)
            </div>
          </div>
        ))}
        <div className="text-[12px] text-text-faint mt-3">
          Roles are built into the app with fixed permissions, so they can&apos;t be renamed or
          added to. Change what someone can do by editing their role on the{" "}
          <Link href="/users" className="text-accent font-semibold">
            User Management
          </Link>{" "}
          page.
        </div>
      </div>
    </div>
  );
}

export function EmailSection({
  org,
  templates,
  orgId,
}: {
  org: OrgSettingsOrg;
  templates: SavedTemplates;
  orgId?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <NotificationTemplatesForm templates={templates} orgId={orgId} />
      <EmailOptionsForm org={org} orgId={orgId} />
    </div>
  );
}

export function SmtpSection({ org, orgId }: { org: OrgSettingsOrg; orgId?: string }) {
  return <SmtpSettingsForm org={org} orgId={orgId} />;
}
