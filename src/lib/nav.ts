import type { AppUser } from "@/lib/auth";

export type NavItem = { href: string; label: string };

export function navFor(role: AppUser["system_role"]): NavItem[] {
  switch (role) {
    case "platform_owner":
      return [
        { href: "/platform-dashboard", label: "Platform Dashboard" },
        { href: "/tenants", label: "Tenants" },
        { href: "/plan-master", label: "Plan Master" },
        { href: "/invoices", label: "Invoices" },
        { href: "/platform-settings", label: "Platform Settings" },
        { href: "/platform-reports", label: "Task Reports" },
      ];
    case "master_admin":
      return [
        { href: "/org-dashboard", label: "Dashboard" },
        { href: "/org-settings", label: "Organization Settings" },
        { href: "/users", label: "User Management" },
        { href: "/task-management", label: "Task Management" },
        { href: "/reports", label: "Task Reports" },
        { href: "/team-chat", label: "Team Chat" },
      ];
    case "reporting_manager":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/users", label: "User Management" },
        { href: "/task-management", label: "Task Management" },
        { href: "/reports", label: "Task Reports" },
        { href: "/team-chat", label: "Team Chat" },
      ];
    case "user":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/reports", label: "Task Reports" },
        { href: "/team-chat", label: "Team Chat" },
      ];
  }
}
