"use client";

import { useState } from "react";

/**
 * Top-of-page identity: the organization's logo (when one is uploaded) and its
 * name in animated lettering. Handles square, round, oval and wide logos.
 */
export function OrgBrandBar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const showLogo = !!logoUrl && !broken;
  const wide = ratio !== null && ratio > 1.7;

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {showLogo ? (
        <div
          className="h-11 rounded-xl bg-white border border-panel-border flex items-center justify-center overflow-hidden shrink-0 p-1"
          style={{ width: wide ? 140 : 44 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- tenant-uploaded logo of unknown shape */}
          <img
            src={logoUrl}
            alt={`${name} logo`}
            onLoad={(e) => setRatio(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))}
            onError={() => setBroken(true)}
            className="max-w-full max-h-full object-contain"
          />
        </div>
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
