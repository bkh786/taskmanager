import { redirect } from "next/navigation";
import { getCurrentAppUser, roleHome } from "@/lib/auth";
import { getDigiPresenceLogoUrl } from "@/lib/brand";
import { LoginForm } from "./login-form";
import { LoginShowcase } from "./login-showcase";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await getCurrentAppUser();
  if (appUser) redirect(roleHome(appUser.system_role));

  const sp = await searchParams;
  const logoUrl = await getDigiPresenceLogoUrl();

  return (
    // The sign-in page carries the Digi Presence look (ink, gold, blue), not any tenant's.
    <div
      className="flex-1 min-h-full grid grid-cols-1 lg:grid-cols-[2fr_3fr] bg-white"
      style={{ ["--accent" as string]: "#0A84FF", ["--accent-hover" as string]: "#0870d6" }}
    >
      <div className="flex flex-col justify-center items-center px-6 py-10 sm:px-12 gap-4">
        {sp.reason === "idle" ? (
          <div className="w-full max-w-[400px] text-[12.5px] text-text-body bg-chip-bg border border-panel-border rounded-lg px-4 py-2.5">
            You were signed out after 60 minutes of inactivity. Please sign in again.
          </div>
        ) : null}
        <LoginForm logoUrl={logoUrl} />
      </div>
      <LoginShowcase />
    </div>
  );
}
