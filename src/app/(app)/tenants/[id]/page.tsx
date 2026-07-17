import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getTenantById,
  getTenantUsers,
  getTenantManagers,
  getTenantProjects,
  getTenantDesignations,
} from "@/lib/tenant-data";
import { SettingsForm } from "@/components/org-settings/settings-form";
import { LogoUploadForm } from "@/components/org-settings/logo-upload-form";
import { LoginLinkForm } from "@/components/org-settings/login-link-form";
import { UsersManager } from "@/components/users/users-manager";

export default async function TenantManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["platform_owner"]);
  const { id: orgId } = await params;

  const org = await getTenantById(orgId);
  if (!org) notFound();

  const [users, managers, projects, designations] = await Promise.all([
    getTenantUsers(orgId),
    getTenantManagers(orgId),
    getTenantProjects(orgId),
    getTenantDesignations(orgId),
  ]);

  return (
    <div className="max-w-[900px]">
      <Link href="/tenants" className="text-[13px] text-text-sub mb-4 inline-block">
        ← Back to Tenants
      </Link>
      <div className="text-[22px] font-bold text-text-main mb-0.5">{org.name}</div>
      <div className="text-[13.5px] text-text-sub mb-6">
        Full Org Admin access for this tenant, managed on behalf of the organization
      </div>

      <div className="text-[14.5px] font-bold text-text-main mb-3">Organization settings</div>
      <SettingsForm org={org} orgId={orgId} />
      <div className="mt-5">
        <LogoUploadForm logoUrl={org.logo_url} orgId={orgId} />
      </div>
      <div className="mt-5 mb-8">
        <LoginLinkForm
          domain={org.custom_login_domain}
          slug={org.slug}
          defaultDomain={process.env.NEXT_PUBLIC_APP_URL ?? ""}
          orgId={orgId}
        />
      </div>

      <div className="border-t border-panel-border pt-6">
        <UsersManager
          users={users}
          managers={managers}
          projects={projects}
          designations={designations}
          allowedRoles={["user", "reporting_manager", "master_admin"]}
          showReportsTo
          canCreate
          orgId={orgId}
        />
      </div>
    </div>
  );
}
