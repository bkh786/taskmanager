"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { useChatOptional } from "@/components/chat/chat-provider";

const ICON_PATHS: Record<string, string[]> = {
  plans: ["M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z", "M7.5 7.5h.01"],
  invoices: ["M6 2h12v20l-3-2-3 2-3-2-3 2z", "M9 7h6", "M9 11h6", "M9 15h4"],
  mail: ["M3 5h18v14H3z", "M3 7l9 6 9-6"],
  tasks: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
  chat: ["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", "M8 9h8", "M8 13h5"],
  // dashboard grid
  dashboard: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  // building / org settings (gear)
  settings: [
    "M12 15a3 3 0 100-6 3 3 0 000 6z",
    "M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  ],
  // users
  users: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M9 11a4 4 0 100-8 4 4 0 000 8z", "M23 21v-2a4 4 0 00-3-3.9", "M16 3.1a4 4 0 010 7.8"],
  // upload
  upload: ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  // bar chart report
  reports: ["M3 3v18h18", "M7 14l4-4 4 4 5-6"],
  // copy
  copy: ["M9 9h11v11H9z", "M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"],
  // building (tenants)
  tenants: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 9h2", "M13 9h2", "M9 13h2", "M13 13h2", "M9 17h2", "M13 17h2"],
};

function iconKeyFor(href: string): string {
  if (href.includes("team-chat")) return "chat";
  if (href.includes("plan-master")) return "plans";
  if (href.includes("invoices")) return "invoices";
  if (href.includes("platform-settings")) return "mail";
  if (href.includes("task-management")) return "tasks";
  if (href.includes("bulk-upload")) return "upload";
  if (href.includes("bulk-copy")) return "copy";
  if (href.includes("report")) return "reports";
  if (href.includes("settings")) return "settings";
  if (href.includes("tenants")) return "tenants";
  if (href.includes("users")) return "users";
  return "dashboard";
}

export function NavIcon({ href }: { href: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {ICON_PATHS[iconKeyFor(href)].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Sidebar({ appUser }: { appUser: AppUser }) {
  const pathname = usePathname();
  const nav = navFor(appUser.system_role);
  const chat = useChatOptional();
  const unread = chat?.totalUnread ?? 0;

  return (
    // Fixed-width slot keeps the page layout stable; the panel inside expands
    // over the content on hover (or keyboard focus).
    <div className="relative w-[64px] shrink-0 hidden md:block">
    <aside className="group absolute inset-y-0 left-0 z-30 w-[64px] hover:w-[232px] has-[:focus-visible]:w-[232px] overflow-hidden transition-[width] duration-200 bg-sidebar-bg border-r border-panel-border flex flex-col py-5 px-3 hover:shadow-lg">
      <div className="px-0.5 pb-5 pt-1 h-[66px] shrink-0 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[14px] shrink-0">
          TM
        </div>
        <div className="text-sm font-bold text-text-main whitespace-nowrap opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-opacity duration-150">
          Task Manager
        </div>
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
              className="flex items-center gap-3 px-2.5 py-2.5 rounded-md text-[13.5px] font-semibold whitespace-nowrap"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-body)",
              }}
            >
              <span className="relative shrink-0">
                <NavIcon href={item.href} />
                {item.href === "/team-chat" && unread > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </span>
              <span className="opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-opacity duration-150">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

    </aside>
    </div>
  );
}
