import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { ThemeControls } from "@/components/theme-controls";

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
        <div className="flex justify-end mb-4.5">
          <ThemeControls />
        </div>
        {children}
      </main>
    </div>
  );
}
