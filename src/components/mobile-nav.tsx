"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navFor, NavIcon } from "@/components/sidebar";
import type { AppUser } from "@/lib/auth";

/** Phone/tablet navigation: a menu button that opens a slide-in drawer. */
export function MobileNav({ role }: { role: AppUser["system_role"] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const nav = navFor(role);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="w-9 h-9 rounded-md border border-panel-border bg-panel-bg text-text-body flex items-center justify-center cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-[260px] max-w-[80vw] bg-sidebar-bg border-r border-panel-border flex flex-col py-5 px-3.5 shadow-xl">
            <div className="flex items-center justify-between px-1 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[14px]">
                  TM
                </div>
                <div className="text-sm font-bold text-text-main">Task Manager</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="border-none bg-transparent text-text-faint text-[22px] leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-2.5 py-3 rounded-md text-[14px] font-semibold"
                    style={{
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-body)",
                    }}
                  >
                    <NavIcon href={item.href} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex-1 bg-black/40 border-none cursor-pointer"
          />
        </div>
      ) : null}
    </div>
  );
}
