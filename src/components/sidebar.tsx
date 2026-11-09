"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import type { AppUser } from "@/lib/auth";

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

function navFor(role: AppUser["system_role"]) {
  switch (role) {
    case "platform_owner":
      return [
        { href: "/platform-dashboard", label: "Platform Dashboard" },
        { href: "/tenants", label: "Tenants" },
        { href: "/platform-reports", label: "Reports" },
        { href: "/bulk-upload-users", label: "Bulk Upload Users" },
      ];
    case "master_admin":
      return [
        { href: "/org-dashboard", label: "Dashboard" },
        { href: "/org-settings", label: "Organization Settings" },
        { href: "/users", label: "User Management" },
        { href: "/bulk-upload-users", label: "Bulk Upload Users" },
        { href: "/reports", label: "Reports" },
      ];
    case "reporting_manager":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/users", label: "User Management" },
        { href: "/bulk-copy", label: "Bulk Task Copy" },
        { href: "/reports", label: "Reports" },
      ];
    case "user":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/reports", label: "Reports" },
      ];
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar({ appUser }: { appUser: AppUser }) {
  const pathname = usePathname();
  const nav = navFor(appUser.system_role);

  return (
    // Fixed-width slot keeps the page layout stable; the panel inside expands
    // over the content on hover/keyboard focus.
    <div className="relative w-[68px] shrink-0">
    <aside className="group absolute inset-y-0 left-0 z-30 w-[68px] hover:w-[232px] focus-within:w-[232px] overflow-hidden transition-[width] duration-200 bg-sidebar-bg border-r border-panel-border flex flex-col py-5 px-3.5 hover:shadow-lg">
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
        <div className="w-8 h-8 rounded-[8px] bg-accent text-white flex items-center justify-center font-bold text-[13px] shrink-0">
          TM
        </div>
        <div className="text-sm font-bold text-text-main whitespace-nowrap">Task Manager</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13.5px] font-semibold whitespace-nowrap"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-body)",
              }}
            >
              <span
                className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[11px] font-bold"
                style={{ background: "currentColor" }}
              >
                <span style={{ color: "var(--sidebar-bg)" }}>{item.label[0]}</span>
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="border-t border-panel-border pt-3.5 flex items-center gap-2.5 pl-2">
        <div className="w-7 h-7 rounded-full bg-chip-bg text-text-body flex items-center justify-center font-bold text-[11px] shrink-0">
          {initials(appUser.full_name)}
        </div>
        <div className="flex-1 min-w-0 whitespace-nowrap">
          <div className="text-[12.5px] font-semibold text-text-main truncate">
            {appUser.full_name}
          </div>
          <Link
            href="/account"
            className="text-[11px] text-text-faint hover:text-accent"
          >
            {ROLE_LABELS[appUser.system_role]}
          </Link>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="border-none bg-transparent text-text-faint text-[11px] cursor-pointer whitespace-nowrap"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
    </div>
  );
}
