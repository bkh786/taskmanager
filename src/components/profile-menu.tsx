"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/(app)/actions";
import { ThemeControls } from "@/components/theme-controls";

/** First and last name initials ("Sucheth Ganapathy Rao" -> "SR"). */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "");
  return (first + last).toUpperCase();
}

export function ProfileMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        title={name}
        className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center font-bold text-[13px] border-none cursor-pointer"
      >
        {initialsOf(name)}
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[260px] max-w-[calc(100vw-24px)] bg-panel-bg border border-panel-border rounded-lg shadow-lg z-40 py-1.5">
          <div className="px-4 py-2.5 border-b border-panel-border">
            <div className="text-[13.5px] font-semibold text-text-main truncate">{name}</div>
            <div className="text-[12px] text-text-faint truncate">{email}</div>
            <div className="text-[11.5px] text-text-sub mt-0.5">{roleLabel}</div>
          </div>
          <div className="px-4 py-3 border-b border-panel-border">
            <ThemeControls compact />
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-[13px] text-text-body hover:bg-table-head-bg"
          >
            Update password
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-[13px] text-danger hover:bg-table-head-bg bg-transparent border-none cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
