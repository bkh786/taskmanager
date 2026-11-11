"use client";

import { useState } from "react";

/**
 * Tick one or more projects / departments. Submits one `projectIds` value per
 * ticked box, plus a marker so the server knows the field was on the form
 * (an empty selection then means "no project").
 */
export function ProjectChecklist({
  projects,
  defaultIds = [],
  selectedIds,
  onChange,
}: {
  projects: { id: string; name: string }[];
  defaultIds?: string[];
  /** Controlled mode (used when the parent needs to preset the ticks). */
  selectedIds?: string[];
  onChange?: (ids: string[]) => void;
}) {
  const [internal, setInternal] = useState<string[]>(defaultIds);
  const value = selectedIds ?? internal;

  function toggle(id: string) {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    setInternal(next);
    onChange?.(next);
  }

  return (
    <div>
      <input type="hidden" name="projectsSubmitted" value="1" />
      {projects.length === 0 ? (
        <div className="text-[12px] text-text-faint">
          No projects yet — create them under Organization Settings.
        </div>
      ) : (
        <div className="border border-panel-border rounded-md max-h-[148px] overflow-y-auto bg-panel-bg">
          {projects.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-text-main cursor-pointer hover:bg-table-head-bg"
            >
              <input
                type="checkbox"
                name="projectIds"
                value={p.id}
                checked={value.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
      <div className="text-[11px] text-text-faint mt-1">
        {value.length === 0
          ? "No project selected."
          : `${value.length} selected — the person can work across all of them.`}
      </div>
    </div>
  );
}
