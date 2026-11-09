import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { ProfileMenu } from "@/components/profile-menu";
import { IdleLogout } from "@/components/idle-logout";
import { ChatDock } from "@/components/chat/chat-dock";

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

  return (
    <div className="flex h-dvh bg-body-bg">
      <Sidebar appUser={appUser} />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-10 pt-4 sm:pt-8 pb-15">
        <div className="flex items-center justify-between md:justify-end gap-3 mb-4.5">
          <MobileNav role={appUser.system_role} />
          <ProfileMenu
            name={appUser.full_name}
            email={appUser.email}
            roleLabel={ROLE_LABELS[appUser.system_role]}
          />
        </div>
        {children}
      </main>
      <IdleLogout />
      {appUser.org_id && appUser.system_role !== "platform_owner" ? (
        <ChatDock me={{ id: appUser.id, orgId: appUser.org_id }} />
      ) : null}
    </div>
  );
}
