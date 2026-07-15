"use client";

import { useActionState, useState } from "react";
import { copyTasks } from "@/app/(app)/bulk-copy/actions";
import type { Employee, SourceTask } from "@/lib/org-data";

const initialState = { error: null, copied: 0 };

/** Parent passes `key={sourceId}` so this remounts (resetting checkbox
 * state) whenever the source user changes, instead of syncing via effect. */
export function CopyForm({
  tasks,
  targetCandidates,
}: {
  sourceId: string;
  tasks: SourceTask[];
  targetCandidates: Employee[];
}) {
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [checkedTargets, setCheckedTargets] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(copyTasks, initialState);

  function toggleTask(id: string) {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleTarget(id: string) {
    setCheckedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="grid grid-cols-2 gap-5">
      {[...checkedTasks].map((id) => (
        <input key={id} type="hidden" name="taskIds" value={id} />
      ))}
      {[...checkedTargets].map((id) => (
        <input key={id} type="hidden" name="targetIds" value={id} />
      ))}

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5">
        <div className="text-xs font-bold text-text-sub uppercase mb-2.5">
          Their tasks
        </div>
        {tasks.length === 0 ? (
          <div className="text-[13px] text-text-faint">
            This person has no active tasks to copy.
          </div>
        ) : (
          tasks.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2.5 py-2 border-b border-row-hover-border text-[13.5px] text-text-main cursor-pointer last:border-b-0"
            >
              <input
                type="checkbox"
                checked={checkedTasks.has(t.id)}
                onChange={() => toggleTask(t.id)}
              />
              {t.task_name}
              <span className="ml-auto text-[11px] text-text-faint">
                {t.is_recurring ? t.recurrence_kind : "one-time"}
              </span>
            </label>
          ))
        )}
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5">
        <div className="text-xs font-bold text-text-sub uppercase mb-2.5">Copy to</div>
        {targetCandidates.map((e) => (
          <label
            key={e.id}
            className="flex items-center gap-2.5 py-2 border-b border-row-hover-border text-[13.5px] text-text-main cursor-pointer last:border-b-0"
          >
            <input
              type="checkbox"
              checked={checkedTargets.has(e.id)}
              onChange={() => toggleTarget(e.id)}
            />
            {e.full_name}
            <span className="ml-auto text-[12px] text-text-faint">
              {e.project_name ?? ""}
            </span>
          </label>
        ))}

        {state.error ? (
          <div className="text-[12.5px] text-danger mt-3">{state.error}</div>
        ) : null}
        {!state.error && state.copied > 0 ? (
          <div className="text-[12.5px] text-success mt-3">
            {state.copied} task(s) copied.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || checkedTasks.size === 0 || checkedTargets.size === 0}
          className="mt-4.5 w-full border-none py-2.5 rounded-md text-[13.5px] font-bold bg-accent hover:bg-accent-hover text-white cursor-pointer disabled:opacity-50"
        >
          {pending
            ? "Copying…"
            : `Copy ${checkedTasks.size} task(s) to ${checkedTargets.size} user(s)`}
        </button>
      </div>
    </form>
  );
}
