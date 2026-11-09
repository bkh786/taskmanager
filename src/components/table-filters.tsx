"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type FilterCol<T> = { key: string; label: string; value: (r: T) => string };

/**
 * Header filters for any on-screen table: every column gets a ▼ button that
 * opens a searchable tick-list of that column's values (narrowed by the other
 * columns' filters). Returns the filtered rows, a button for each header cell,
 * and the menu to render once next to the table.
 */
export function useColumnFilters<T>(
  rows: T[],
  cols: FilterCol<T>[],
  onChange?: () => void
): {
  filtered: T[];
  activeCount: number;
  clearAll: () => void;
  headerButton: (key: string) => ReactNode;
  menu: ReactNode;
} {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState<{ key: string; top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const passes = (r: T, skip?: string) =>
    cols.every((c) => {
      if (c.key === skip) return true;
      const sel = selected[c.key];
      return !sel || sel.length === 0 || sel.includes(c.value(r));
    });

  const filtered = useMemo(
    () => rows.filter((r) => passes(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selected, cols]
  );

  const options = useMemo(() => {
    if (!open) return [];
    const col = cols.find((c) => c.key === open.key);
    if (!col) return [];
    const set = new Set<string>();
    for (const r of rows) if (passes(r, open.key)) set.add(col.value(r));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows, selected, cols]);

  const activeCount = Object.values(selected).filter((v) => v.length > 0).length;

  function toggle(key: string, v: string) {
    setSelected((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
    onChange?.();
  }

  const headerButton = (key: string) => {
    const col = cols.find((c) => c.key === key);
    if (!col) return null;
    const active = (selected[key]?.length ?? 0) > 0;
    return (
      <button
        type="button"
        title={`Filter ${col.label}`}
        aria-label={`Filter ${col.label}`}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setSearch("");
          setOpen(
            open?.key === key
              ? null
              : { key, top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 270)) }
          );
        }}
        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] border-none cursor-pointer shrink-0 ${
          active ? "bg-accent text-white" : "bg-transparent text-text-faint hover:text-accent"
        }`}
      >
        ▼
      </button>
    );
  };

  const menu = open ? (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: open.top, left: open.left }}
      className="z-50 w-[260px] bg-panel-bg border border-panel-border rounded-md shadow-lg p-2 normal-case font-normal"
    >
      <input
        autoFocus
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search values…"
        className="w-full px-2 py-1.5 mb-1.5 border border-panel-border rounded-md text-[12.5px] bg-panel-bg text-text-main"
      />
      <div className="max-h-[240px] overflow-y-auto">
        {options
          .filter((v) => v.toLowerCase().includes(search.trim().toLowerCase()))
          .slice(0, 300)
          .map((v) => (
            <label key={v} className="flex items-center gap-2 text-[12.5px] text-text-body px-1.5 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={(selected[open.key] ?? []).includes(v)}
                onChange={() => toggle(open.key, v)}
              />
              <span className="truncate">{v}</span>
            </label>
          ))}
        {options.length === 0 ? <div className="text-[12px] text-text-faint px-1.5 py-1">No values</div> : null}
      </div>
      {(selected[open.key]?.length ?? 0) > 0 ? (
        <button
          type="button"
          onClick={() => {
            setSelected((p) => ({ ...p, [open.key]: [] }));
            onChange?.();
          }}
          className="text-[11.5px] text-accent font-semibold mt-1.5 px-1.5 cursor-pointer bg-transparent border-none"
        >
          Clear
        </button>
      ) : null}
    </div>
  ) : null;

  return {
    filtered,
    activeCount,
    clearAll: () => {
      setSelected({});
      onChange?.();
    },
    headerButton,
    menu,
  };
}
