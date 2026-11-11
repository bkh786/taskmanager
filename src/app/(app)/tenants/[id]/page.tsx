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
import { GeneralSection, EmailSection, SmtpSection } from "@/components/org-settings/settings-sections";
import { getSavedTemplates, toSettingsOrg } from "@/lib/org-settings-data";
import { UsersManager } from "@/components/users/users-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantBillingForm, TenantManagementForm } from "@/components/platform/tenant-billing-tab";
import { InvoicesTable } from "@/components/platform/invoices-table";

const TABS = [
  { key: "org", label: "Organization Settings" },
  { key: "smtp", label: "SMTP Settings" },
  { key: "notifications", label: "Notification Settings" },
  { key: "users", label: "User Management" },
  { key: "billing", label: "Billing" },
  { key: "tenant", label: "Tenant Management" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function TenantManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["platform_owner"]);
  const { id: orgId } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "org";

  const org = await getTenantById(orgId);
  if (!org) notFound();

  return (
    <div className="max-w-[1000px]">
      <Link href="/tenants" className="text-[13px] text-text-sub mb-4 inline-block">
        ← Back to Tenants
      </Link>
      <div className="text-[22px] font-bold text-text-main mb-0.5">{org.name}</div>
      <div className="text-[13.5px] text-text-sub mb-4">
        Full Org Admin access for this tenant, managed on behalf of the organization
      </div>

      <div className="flex gap-1 border-b border-panel-border mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/tenants/${orgId}?tab=${t.key}`}
            className="px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap -mb-px border-b-2"
            style={{ borderColor: t.key === tab ? "var(--accent)" : "transparent", color: t.key === tab ? "var(--accent)" : "var(--text-sub)" }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "org" ? (
        <GeneralSection org={toSettingsOrg(org)} orgId={orgId} />
      ) : null}
      {tab === "smtp" ? <SmtpSection org={toSettingsOrg(org)} orgId={orgId} /> : null}
      {tab === "notifications" ? (
        <EmailSection org={toSettingsOrg(org)} templates={await getSavedTemplates(orgId)} orgId={orgId} />
      ) : null}
      {tab === "users" ? <TenantUsers orgId={orgId} org={org} /> : null}
      {tab === "billing" ? <BillingTab orgId={orgId} org={org} /> : null}
      {tab === "tenant" ? <TenantTab org={org} /> : null}
    </div>
  );
}

async function TenantUsers({ orgId, org }: { orgId: string; org: NonNullable<Awaited<ReturnType<typeof getTenantById>>> }) {
  const [users, managers, projects, designations] = await Promise.all([
    getTenantUsers(orgId),
    getTenantManagers(orgId),
    getTenantProjects(orgId),
    getTenantDesignations(orgId),
  ]);
  return (
    <UsersManager
      users={users}
      managers={managers}
      projects={projects}
      designations={designations}
      allowedRoles={["user", "reporting_manager", "master_admin"]}
      showReportsTo
      canCreate
      orgId={orgId}
      showProjectsPanel
      bulkOrgs={[{ id: org.id, slug: org.slug, name: org.name }]}
    />
  );
}

async function BillingTab({ orgId, org }: { orgId: string; org: NonNullable<Awaited<ReturnType<typeof getTenantById>>> }) {
  const admin = createAdminClient();
  const [{ data: plans }, { data: invoices }] = await Promise.all([
    admin.from("plans").select("*").order("price"),
    admin.from("invoices").select("*").eq("org_id", orgId).order("period_start", { ascending: false }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <TenantBillingForm org={org} plans={plans ?? []} />
      <div>
        <div className="text-[14.5px] font-bold text-text-main mb-3">Invoices &amp; payments</div>
        <InvoicesTable invoices={invoices ?? []} />
      </div>
    </div>
  );
}

async function TenantTab({ org }: { org: NonNullable<Awaited<ReturnType<typeof getTenantById>>> }) {
  const admin = createAdminClient();
  const { count } = await admin.from("app_users").select("id", { count: "exact", head: true }).eq("org_id", org.id);
  return <TenantManagementForm org={org} userCount={count ?? 0} />;
}
