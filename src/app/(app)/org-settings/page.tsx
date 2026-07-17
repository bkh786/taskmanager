import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/org-settings/settings-form";
import { LogoUploadForm } from "@/components/org-settings/logo-upload-form";
import { LoginLinkForm } from "@/components/org-settings/login-link-form";

const ROLES = [
  { name: "Employee", permissions: "View & complete own tasks" },
  {
    name: "Reporting Manager",
    permissions: "Manages users, tasks, and reports within their reporting chain",
  },
  { name: "Org Admin", permissions: "Full control within the organization" },
];

export default async function OrgSettingsPage() {
  const appUser = await requireRole(["master_admin"]);
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", appUser.org_id ?? "")
    .single();
  if (error || !org) {
    return <div className="text-[13.5px] text-danger">Could not load organization.</div>;
  }

  const { count: employeeCount } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("org_id", appUser.org_id ?? "");

  return (
    <div className="max-w-[760px]">
      <div className="text-[22px] font-bold text-text-main mb-0.5">
        Organization Settings
      </div>
      <div className="text-[13.5px] text-text-sub mb-5">
        Company profile, roles, and email configuration
      </div>

      <SettingsForm org={org} />

      <div className="mt-5">
        <LogoUploadForm logoUrl={org.logo_url} />
      </div>

      <div className="mt-5">
        <LoginLinkForm
          domain={org.custom_login_domain}
          slug={org.slug}
          defaultDomain={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        />
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5 mt-5">
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
        <Link
          href="/users"
          className="inline-block mt-3.5 text-[13px] font-semibold text-accent"
        >
          Manage employee list →
        </Link>
      </div>
    </div>
  );
}
