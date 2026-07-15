"use client";

import { useState } from "react";

const THEMES = [
  { id: "blue", swatch: "oklch(0.55 0.14 250)" },
  { id: "violet", swatch: "oklch(0.5 0.16 300)" },
  { id: "teal", swatch: "oklch(0.52 0.1 190)" },
  { id: "amber", swatch: "oklch(0.58 0.15 70)" },
] as const;

export function ThemeControls() {
  // Read once from the DOM attributes the layout's inline theme-init script
  // already set before hydration (see app/layout.tsx), so this never touches
  // localStorage synchronously in an effect and never disagrees with the SSR
  // markup enough to matter -- it only affects which swatch shows a ring.
  const [theme, setTheme] = useState(() =>
    typeof document !== "undefined"
      ? (document.documentElement.getAttribute("data-theme") ?? "blue")
      : "blue"
  );
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-mode") === "dark"
      : false
  );

  function applyTheme(id: string) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    localStorage.setItem("tm-theme", id);
  }

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-mode", next ? "dark" : "light");
    localStorage.setItem("tm-mode", next ? "dark" : "light");
  }

  return (
    <div className="flex items-center gap-3.5 mb-4.5">
      <span className="text-[11.5px] font-semibold text-text-sub">Theme</span>
      <div className="flex gap-1.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTheme(t.id)}
            aria-label={`${t.id} theme`}
            className="w-5 h-5 rounded-full cursor-pointer p-0"
            suppressHydrationWarning
            style={{
              background: t.swatch,
              border: `2px solid ${theme === t.id ? t.swatch : "transparent"}`,
              outline: theme === t.id ? "1px solid var(--panel-border)" : "none",
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={toggleDark}
        aria-label="Toggle dark mode"
        className="relative w-[38px] h-[22px] rounded-full border-none cursor-pointer p-0"
        suppressHydrationWarning
        style={{ background: dark ? "var(--accent)" : "#d6d6d3" }}
      >
        <span
          className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-[left]"
          suppressHydrationWarning
          style={{ left: dark ? "18px" : "2px" }}
        />
      </button>
      <span className="text-[11.5px] font-semibold text-text-sub">Dark mode</span>
    </div>
  );
}
