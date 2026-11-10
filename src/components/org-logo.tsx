"use client";

import { useState } from "react";

/**
 * The organization's logo in the navigation, whatever its shape. Square,
 * round and oval logos get a compact tile with the organization name beside
 * them; wide rectangular logos get the full width instead. `collapsed` keeps
 * it to a square slot (the icon-only sidebar).
 */
export function OrgLogo({
  logoUrl,
  name,
  collapsed = false,
}: {
  logoUrl: string | null;
  name: string;
  collapsed?: boolean;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);

  if (!logoUrl || broken) {
    // No logo uploaded: the plain monogram tile and app name.
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[13px] shrink-0">
          {name.trim().slice(0, 2).toUpperCase() || "TM"}
        </div>
        {!collapsed ? <div className="text-sm font-bold text-text-main whitespace-nowrap">{name}</div> : null}
      </div>
    );
  }

  const wide = ratio !== null && ratio > 1.7;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-[10px] bg-white border border-panel-border flex items-center justify-center overflow-hidden shrink-0"
        style={{
          width: wide && !collapsed ? 150 : 40,
          height: 40,
          padding: 3,
        }}
        title={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant-uploaded logo of unknown shape */}
        <img
          src={logoUrl}
          alt={name}
          onLoad={(e) => setRatio(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))}
          onError={() => setBroken(true)}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      {!collapsed && !wide ? (
        <div className="text-sm font-bold text-text-main whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
          {name}
        </div>
      ) : null}
    </div>
  );
}
