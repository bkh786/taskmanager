import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getOrgSettings, getSavedTemplates } from "@/lib/org-settings-data";
import {
  GeneralSection,
  VariablesSection,
  EmailSection,
  SmtpSection,
} from "@/components/org-settings/settings-sections";

const TABS = [
  { key: "general", label: "General" },
  { key: "variables", label: "Project variables" },
  { key: "email", label: "Email templates" },
  { key: "smtp", label: "SMTP configuration" },
] as const;

export default async function OrgSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["master_admin"]);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "general";
  const orgId = appUser.org_id ?? "";

  const org = await getOrgSettings(orgId);
  if (!org) {
    return <div className="text-[13.5px] text-danger">Could not load organization.</div>;
  }
  const templates = tab === "email" ? await getSavedTemplates(orgId) : {};

  return (
    <div className="max-w-[920px]">
      <div className="text-[22px] font-bold text-text-main mb-0.5">Organization Settings</div>
      <div className="text-[13.5px] text-text-sub mb-4">
        Company profile, project variables, email templates and SMTP
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

      {tab === "general" ? <GeneralSection org={org} /> : null}
      {tab === "variables" ? <VariablesSection orgId={orgId} /> : null}
      {tab === "email" ? <EmailSection org={org} templates={templates} /> : null}
      {tab === "smtp" ? <SmtpSection org={org} /> : null}
    </div>
  );
}
