import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentAppUser, roleHome } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

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
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg">
      <LoginForm branding={branding} />
    </div>
  );
}
