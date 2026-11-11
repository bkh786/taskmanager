import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPlatformEmailSettings } from "@/lib/platform-email";
import { PlatformSmtpForm, type PlatformSmtp } from "@/components/platform/platform-smtp-form";
import { PlatformTemplatesForm, type SavedPlatformTemplates } from "@/components/platform/platform-templates-form";

const TABS = [
  { key: "smtp", label: "SMTP configuration" },
  { key: "templates", label: "Email templates" },
] as const;

export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["platform_owner"]);
  const sp = await searchParams;
  const tab = sp.tab === "templates" ? "templates" : "smtp";

  let body: React.ReactNode;
  if (tab === "smtp") {
    const s = await loadPlatformEmailSettings();
    const { smtp_password, ...rest } = s ?? ({ id: 1, smtp_secure: "auto" } as never as NonNullable<typeof s>);
    const settings: PlatformSmtp = { ...rest, has_smtp_password: !!smtp_password };
    body = <PlatformSmtpForm settings={settings} />;
  } else {
    const { data } = await createAdminClient().from("platform_email_templates").select("*");
    const saved: SavedPlatformTemplates = {};
    for (const r of data ?? []) saved[r.event] = { enabled: r.enabled, subject: r.subject, body: r.body };
    body = <PlatformTemplatesForm templates={saved} />;
  }

  return (
    <div>
      <div className="text-[22px] font-bold text-text-main mb-0.5">Platform Settings</div>
      <div className="text-[13.5px] text-text-sub mb-4">
        Email from the platform to tenants: invoices, billing reminders, plan changes and offers
      </div>
      <div className="flex gap-1 border-b border-panel-border mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/platform-settings?tab=${t.key}`}
            className="px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap -mb-px border-b-2"
            style={{ borderColor: t.key === tab ? "var(--accent)" : "transparent", color: t.key === tab ? "var(--accent)" : "var(--text-sub)" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {body}
    </div>
  );
}
