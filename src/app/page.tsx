import { redirect } from "next/navigation";
import { getCurrentAppUser, roleHome } from "@/lib/auth";

export default async function Home() {
  const appUser = await getCurrentAppUser();
  redirect(appUser ? roleHome(appUser.system_role) : "/login");
}
