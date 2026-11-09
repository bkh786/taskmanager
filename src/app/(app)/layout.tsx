import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { ThemeControls } from "@/components/theme-controls";
import { ProfileMenu } from "@/components/profile-menu";
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
    <div className="flex h-screen bg-body-bg">
      <Sidebar appUser={appUser} />
      <main className="flex-1 overflow-y-auto px-10 pt-8 pb-15">
        <div className="flex justify-end items-center gap-5 mb-4.5">
          <ThemeControls />
          <ProfileMenu
            name={appUser.full_name}
            email={appUser.email}
            roleLabel={ROLE_LABELS[appUser.system_role]}
          />
        </div>
        {children}
      </main>
      {appUser.org_id && appUser.system_role !== "platform_owner" ? (
        <ChatDock me={{ id: appUser.id, orgId: appUser.org_id }} />
      ) : null}
    </div>
  );
}
