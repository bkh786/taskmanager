import { redirect } from "next/navigation";
import { getCurrentAppUser, roleHome } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const appUser = await getCurrentAppUser();
  if (appUser) redirect(roleHome(appUser.system_role));

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg">
      <LoginForm />
    </div>
  );
}
