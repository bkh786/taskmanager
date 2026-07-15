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
      return [{ href: "/tenants", label: "Tenants" }];
    case "master_admin":
      return [
        { href: "/org-settings", label: "Organization Settings" },
        { href: "/users", label: "User Management" },
      ];
    case "reporting_manager":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/users", label: "User Management" },
        { href: "/bulk-copy", label: "Bulk Task Copy" },
        { href: "/reports", label: "Reports" },
      ];
    case "user":
      return [{ href: "/dashboard", label: "Dashboard" }];
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
    <aside className="w-[232px] shrink-0 bg-sidebar-bg border-r border-panel-border flex flex-col py-5 px-3.5">
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
        <div className="w-8 h-8 rounded-[8px] bg-accent text-white flex items-center justify-center font-bold text-[13px] shrink-0">
          TM
        </div>
        <div className="text-sm font-bold text-text-main">Task Manager</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-[13.5px] font-semibold"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-body)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-sm"
                style={{ background: "currentColor", opacity: 0.7 }}
              />
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
        <div className="flex-1 min-w-0">
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
            className="border-none bg-transparent text-text-faint text-[11px] cursor-pointer"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
