"use client";

import { useState } from "react";

/**
 * Top-of-page identity: the organization's logo (when one is uploaded) and its
 * name in animated lettering. Handles square, round, oval and wide logos.
 */
export function OrgBrandBar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const showLogo = !!logoUrl && !broken;

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {showLogo ? (
        // The logo itself, at its own proportions: no box, border or padding around it.
        // eslint-disable-next-line @next/next/no-img-element -- tenant-uploaded logo of unknown shape
        <img
          src={logoUrl}
          alt={`${name} logo`}
          onError={() => setBroken(true)}
          className="h-11 w-auto max-w-[240px] object-contain shrink-0"
        />
      ) : null}
      <div
        className="text-[18px] sm:text-[22px] font-extrabold tracking-tight leading-tight min-w-0 overflow-hidden whitespace-nowrap"
        aria-label={name}
      >
        {name.split("").map((ch, i) => (
          <span key={i} aria-hidden="true" className="tm-org-letter" style={{ ["--i" as string]: i }}>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </div>
    </div>
  );
}
