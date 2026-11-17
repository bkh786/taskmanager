import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { InboxView } from "@/components/notifications/inbox-view";
import { PushSettings } from "@/components/notifications/push-settings";

export default async function NotificationsPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  // The platform owner sends notifications rather than receiving them.
  if (appUser.system_role === "platform_owner") redirect("/notification-center");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[22px] font-bold text-text-main mb-0.5">Notifications</div>
        <div className="text-[13.5px] text-text-sub">Critical alerts and updates, newest first.</div>
      </div>
      <PushSettings userId={appUser.id} />
      <InboxView />
    </div>
  );
}
