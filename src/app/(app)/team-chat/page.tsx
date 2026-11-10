import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { TeamChatView } from "@/components/chat/team-chat-view";

export default async function TeamChatPage() {
  const appUser = await requireRole(["master_admin", "reporting_manager", "user"]);
  if (!appUser.org_id) redirect("/");
  return <TeamChatView />;
}
