import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentAppUser, roleHome } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { LoginShowcase } from "./login-showcase";

export type OrgBranding = { name: string; logoUrl: string | null };

async function getOrgBranding(slug: string | null): Promise<OrgBranding | null> {
  if (!slug) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_branding")
    .select("name, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || !data.name) return null;
  return { name: data.name, logoUrl: data.logo_url };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const appUser = await getCurrentAppUser();
  if (appUser) redirect(roleHome(appUser.system_role));

  const sp = await searchParams;
  const cookieStore = await cookies();
  const slug = sp.org || cookieStore.get("tm-org")?.value || null;
  const branding = await getOrgBranding(slug);

  return (
    <div className="min-h-dvh grid grid-cols-1 lg:grid-cols-[2fr_3fr] bg-panel-bg">
      <div className="flex flex-col justify-center items-center px-6 py-10 sm:px-12 gap-4">
        {sp.reason === "idle" ? (
          <div className="w-full max-w-[400px] text-[12.5px] text-text-body bg-chip-bg border border-panel-border rounded-lg px-4 py-2.5">
            You were signed out after 60 minutes of inactivity. Please sign in again.
          </div>
        ) : null}
        <LoginForm branding={branding} />
        <div className="w-full max-w-[400px] text-[11.5px] text-text-faint mt-6">
          © {new Date().getFullYear()} {branding?.name ?? "Task Manager"}
        </div>
      </div>
      <LoginShowcase />
    </div>
  );
}
