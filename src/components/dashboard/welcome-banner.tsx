"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Part = "morning" | "afternoon" | "evening" | "night" | "late";

function partOfDay(hour: number): Part {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  if (hour >= 21) return "night";
  return "late";
}

const GREETING: Record<Part, string> = {
  morning: "Good Morning",
  afternoon: "Good Afternoon",
  evening: "Good Evening",
  night: "Good Night",
  late: "Working late",
};

function Icon({ part }: { part: Part }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (part === "morning" || part === "afternoon") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (part === "evening") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M17 18a5 5 0 00-10 0" />
        <path d="M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  );
}

const IST = "Asia/Kolkata";

export type BannerLink = { href: string; label: string };

/**
 * Greeting, live IST date/time and a thought of the day, themed with the
 * user's chosen accent colour. The time is only read after mount so the
 * server-rendered markup never disagrees with the browser's clock.
 */
export function WelcomeBanner({
  firstName,
  quote,
  links,
}: {
  firstName: string;
  quote: { text: string; author: string };
  links: BannerLink[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const hour = now
    ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", hour12: false }).format(now)) % 24
    : 9;
  const part = partOfDay(hour);
  const dateText = now
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: IST,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now)
    : "";
  const timeText = now
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: IST,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
        .format(now)
        .toLowerCase()
    : "";
  const dark = part === "night" || part === "late";

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-7 py-6 mb-6 text-white"
      style={{
        background:
          "linear-gradient(120deg, var(--accent) 0%, color-mix(in oklab, var(--accent) 55%, #000) 100%)",
      }}
    >
      {/* decorative sun / moon and soft shapes */}
      <div
        aria-hidden="true"
        className="absolute -right-6 -top-6 w-[150px] h-[150px] rounded-full"
        style={{
          background: dark
            ? "radial-gradient(circle at 35% 35%, #fff, #dfe6ee 60%, #b8c3d0)"
            : "radial-gradient(circle at 50% 50%, #ffe9a8, #ffc857 55%, rgba(255,200,87,0.15) 100%)",
          opacity: dark ? 0.95 : 0.85,
          boxShadow: dark ? "0 0 60px 10px rgba(255,255,255,0.25)" : "0 0 70px 20px rgba(255,200,87,0.35)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute right-[160px] bottom-0 w-[260px] h-[90px] rounded-t-[60px] opacity-[0.12] bg-black"
      />
      <div
        aria-hidden="true"
        className="absolute right-[40px] bottom-0 w-[160px] h-[60px] rounded-t-[40px] opacity-[0.15] bg-black"
      />
      {dark ? (
        <>
          <span aria-hidden="true" className="absolute right-[200px] top-6 w-1 h-1 rounded-full bg-white/80" />
          <span aria-hidden="true" className="absolute right-[260px] top-12 w-[3px] h-[3px] rounded-full bg-white/70" />
          <span aria-hidden="true" className="absolute right-[330px] top-5 w-[3px] h-[3px] rounded-full bg-white/60" />
        </>
      ) : null}

      <div className="relative">
        <div className="flex items-center gap-2 text-[13px] opacity-90 min-h-[20px]">
          <Icon part={part} />
          <span>
            {dateText}
            {timeText ? ` · ${timeText} IST` : ""}
          </span>
        </div>
        <div className="text-[28px] font-extrabold mt-1.5 leading-tight">
          {GREETING[part]}, {firstName}!
        </div>
        <div className="mt-2 text-[13.5px] max-w-[640px] opacity-95">
          “{quote.text}” <span className="opacity-75">— {quote.author}</span>
        </div>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold text-white border border-white/35 bg-white/10 hover:bg-white/20"
              >
                {l.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
