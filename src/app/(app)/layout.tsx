import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { OrgBrandBar } from "@/components/org-brand-bar";
import { ProfileMenu } from "@/components/profile-menu";
import { IdleLogout } from "@/components/idle-logout";
import { ChatDock } from "@/components/chat/chat-dock";
import { ChatProvider } from "@/components/chat/chat-provider";

const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
} as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");

  // The organization's own logo and name for the navigation (platform owners
  // have no organization, so they get the plain Task Manager mark).
  let org = { name: "Task Manager", logoUrl: null as string | null };
  if (appUser.org_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("name, logo_url")
      .eq("id", appUser.org_id)
      .maybeSingle();
    if (data) org = { name: data.name, logoUrl: data.logo_url };
  }

  const chatMe =
    appUser.org_id && appUser.system_role !== "platform_owner"
      ? { id: appUser.id, orgId: appUser.org_id }
      : null;

  return (
    <ChatProvider me={chatMe}>
    <div className="flex flex-1 min-h-0 bg-body-bg">
      <Sidebar appUser={appUser} org={org} />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-10 pt-4 sm:pt-8 pb-15">
        <div className="flex items-center gap-3 mb-4.5">
          <MobileNav role={appUser.system_role} org={org} />
          <OrgBrandBar name={org.name} logoUrl={org.logoUrl} />
          <ProfileMenu
            name={appUser.full_name}
            email={appUser.email}
            roleLabel={ROLE_LABELS[appUser.system_role]}
          />
        </div>
        {children}
      </main>
      <IdleLogout />
      {chatMe ? <ChatDock /> : null}
    </div>
    </ChatProvider>
  );
}
