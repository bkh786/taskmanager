import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnnouncementForm } from "@/components/notification-center/announcement-form";
import { AnnouncementHistory, type AnnouncementRow } from "@/components/notification-center/announcement-history";
import { RulesEditor, type RuleRow } from "@/components/notification-center/rules-editor";
import { AUDIENCE_ROLES, type Audience } from "@/lib/notification-shared";
import { pushConfigured } from "@/lib/notify";

function audienceText(a: Audience, names: { projects: Map<string, string>; orgs: Map<string, string> }, isPlatform: boolean): string {
  switch (a.scope) {
    case "roles":
      return a.roles.map((r) => AUDIENCE_ROLES.find((x) => x.value === r)?.label ?? r).join(", ");
    case "projects":
      return a.project_ids.map((id) => names.projects.get(id) ?? "Project").join(", ");
    case "users":
      return `${a.user_ids.length} ${a.user_ids.length === 1 ? "person" : "people"}`;
    case "orgs": {
      const who = a.org_ids ? a.org_ids.map((id) => names.orgs.get(id) ?? "Organization").join(", ") : "All organizations";
      return `${who}${a.admins_only ? " (admins only)" : ""}`;
    }
    default:
      return isPlatform ? "All organizations" : "Everyone";
  }
}

export default async function NotificationCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await requireRole(["master_admin", "platform_owner"]);
  const isPlatform = appUser.system_role === "platform_owner";
  const sp = await searchParams;
  const tab = !isPlatform && sp.tab === "rules" ? "rules" : "announcements";
  const admin = createAdminClient();
  const orgId = isPlatform ? null : appUser.org_id;

  // Reach: how many people have push on, out of everyone who could.
  const [devices, people] = await Promise.all([
    (isPlatform
      ? admin.from("push_subscriptions").select("user_id")
      : admin.from("push_subscriptions").select("user_id").eq("org_id", orgId!)
    ).limit(5000),
    isPlatform
      ? admin.from("app_users").select("id", { count: "exact", head: true }).eq("is_active", true).neq("system_role", "platform_owner")
      : admin.from("app_users").select("id", { count: "exact", head: true }).eq("org_id", orgId!).eq("is_active", true),
  ]);
  const pushUsers = new Set((devices.data ?? []).map((d) => d.user_id)).size;

  let aQuery = admin.from("announcements").select("*").order("created_at", { ascending: false }).limit(30);
  aQuery = isPlatform ? aQuery.is("org_id", null) : aQuery.eq("org_id", orgId!);
  const { data: announcements } = await aQuery;

  const [{ data: projects }, { data: orgPeople }, { data: orgs }, { data: rules }] = await Promise.all([
    isPlatform ? Promise.resolve({ data: [] as { id: string; name: string }[] }) : admin.from("projects").select("id, name").eq("org_id", orgId!).order("name"),
    isPlatform
      ? Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] })
      : admin.from("app_users").select("id, full_name, email").eq("org_id", orgId!).eq("is_active", true).order("full_name").limit(2000),
    isPlatform ? admin.from("organizations").select("id, name").eq("is_active", true).order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    isPlatform ? Promise.resolve({ data: [] }) : admin.from("notification_rules").select("*").eq("org_id", orgId!).order("after_days").order("created_at"),
  ]);

  const names = {
    projects: new Map((projects ?? []).map((p) => [p.id, p.name])),
    orgs: new Map((orgs ?? []).map((o) => [o.id, o.name])),
  };
  const sentIds = (announcements ?? []).filter((a) => a.status === "sent").map((a) => a.id);
  const readCounts = new Map<string, number>();
  await Promise.all(
    sentIds.map(async (id) => {
      const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("ref_id", id).not("read_at", "is", null);
      readCounts.set(id, count ?? 0);
    })
  );
  const rows: AnnouncementRow[] = (announcements ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    level: a.level,
    status: a.status,
    audience: audienceText(a.audience as unknown as Audience, names, isPlatform),
    when: new Date(a.status === "scheduled" && a.publish_at ? a.publish_at : (a.sent_at ?? a.created_at)).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }),
    recipients: a.recipient_count,
    read: readCounts.get(a.id) ?? 0,
  }));

  const TABS = isPlatform
    ? ([{ key: "announcements", label: "Announcements" }] as const)
    : ([
        { key: "announcements", label: "Announcements" },
        { key: "rules", label: "Automatic alerts" },
      ] as const);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[22px] font-bold text-text-main mb-0.5">Notification Center</div>
        <div className="text-[13.5px] text-text-sub">
          {isPlatform
            ? "Send feature updates and notices to organizations."
            : "Send announcements and decide which automatic alerts your team receives."}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-panel-bg border border-panel-border rounded-xl px-4 py-3">
          <div className="text-[11.5px] font-bold uppercase text-text-sub">Active people</div>
          <div className="text-[22px] font-bold text-text-main">{people.count ?? 0}</div>
        </div>
        <div className="bg-panel-bg border border-panel-border rounded-xl px-4 py-3">
          <div className="text-[11.5px] font-bold uppercase text-text-sub">Push turned on</div>
          <div className="text-[22px] font-bold text-text-main">
            {pushUsers}
            <span className="text-[13px] font-semibold text-text-sub"> people</span>
          </div>
        </div>
        <div className="bg-panel-bg border border-panel-border rounded-xl px-4 py-3">
          <div className="text-[11.5px] font-bold uppercase text-text-sub">Push service</div>
          <div className="text-[15px] font-bold" style={{ color: pushConfigured() ? "var(--success)" : "var(--danger)" }}>
            {pushConfigured() ? "Ready" : "Not set up"}
          </div>
        </div>
      </div>

      {TABS.length > 1 ? (
        <div className="flex gap-1 border-b border-panel-border overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/notification-center?tab=${t.key}`}
              className="px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap -mb-px border-b-2"
              style={{ borderColor: tab === t.key ? "var(--accent)" : "transparent", color: tab === t.key ? "var(--accent)" : "var(--text-sub)" }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}

      {tab === "rules" ? (
        <RulesEditor rules={(rules ?? []) as unknown as RuleRow[]} />
      ) : (
        <>
          <AnnouncementForm
            mode={isPlatform ? "platform" : "org"}
            projects={projects ?? []}
            people={(orgPeople ?? []).map((p) => ({ id: p.id, name: `${p.full_name} (${p.email})` }))}
            orgs={orgs ?? []}
          />
          <AnnouncementHistory rows={rows} />
        </>
      )}
    </div>
  );
}
