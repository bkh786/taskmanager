"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTask } from "@/app/(app)/dashboard/actions";
import type { Employee } from "@/lib/org-data";
import { todayIso } from "@/lib/task-status";

const initialState = { error: null };

export function CreateTaskModal({ employees }: { employees: Employee[] }) {
  const [open, setOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [kind, setKind] = useState<"daily" | "weekly" | "monthly">("daily");
  const [noEnd, setNoEnd] = useState(true);
  const [state, formAction, pending] = useActionState(createTask, initialState);
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (submittedOnce.current && !pending && state.error === null) {
      setOpen(false);
      submittedOnce.current = false;
    }
  }, [pending, state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
      >
        + New Task
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
      >
        + New Task
      </button>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="w-[480px] max-h-[88vh] overflow-y-auto bg-panel-bg rounded-xl px-7 py-6 shadow-xl">
          <div className="text-[16.5px] font-bold text-text-main mb-4.5">
            New Task
          </div>
          <form
            action={(fd) => {
              submittedOnce.current = true;
              formAction(fd);
            }}
            className="flex flex-col gap-3.5"
          >
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Task name
              </label>
              <input
                name="taskName"
                required
                placeholder="e.g. Prepare Q3 budget summary"
                className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Details, links, context…"
                className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Assignee
              </label>
              <select
                name="assigneeId"
                required
                className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
              >
                <option value="">Select an employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                    {e.project_name ? ` — ${e.project_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Schedule
              </label>
              <div className="flex bg-chip-bg rounded-lg p-[3px] gap-0.5">
                <button
                  type="button"
                  onClick={() => setRecurring(false)}
                  className="flex-1 border-none py-1.5 rounded-md text-[13px] font-semibold cursor-pointer"
                  style={{
                    background: !recurring ? "var(--panel-bg)" : "transparent",
                    color: !recurring ? "var(--accent)" : "var(--text-body)",
                  }}
                >
                  One-time
                </button>
                <button
                  type="button"
                  onClick={() => setRecurring(true)}
                  className="flex-1 border-none py-1.5 rounded-md text-[13px] font-semibold cursor-pointer"
                  style={{
                    background: recurring ? "var(--panel-bg)" : "transparent",
                    color: recurring ? "var(--accent)" : "var(--text-body)",
                  }}
                >
                  Recurring
                </button>
              </div>
              <input
                type="hidden"
                name="scheduleType"
                value={recurring ? "recurring" : "one_time"}
              />
            </div>

            {recurring ? (
              <div className="bg-table-head-bg rounded-lg p-3 flex flex-col gap-2.5">
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className="flex-1 border-none py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer capitalize"
                      style={{
                        background: kind === k ? "var(--panel-bg)" : "transparent",
                        color: kind === k ? "var(--accent)" : "var(--text-body)",
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="recurrenceKind" value={kind} />
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-text-body">Every</span>
                  <input
                    type="number"
                    name="recurrenceInterval"
                    min={1}
                    defaultValue={1}
                    className="w-14 px-2 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                  />
                  <span className="text-[12.5px] text-text-body">
                    {kind === "daily" ? "day(s)" : kind === "weekly" ? "week(s)" : "month(s)"}
                  </span>
                </div>
                <div className="text-[11px] text-text-faint">
                  {kind === "monthly"
                    ? "Recurs on the same day-of-month as the start date; clamped to the last day for shorter months."
                    : "Recurs on the same weekday/interval as the start date."}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Start date
                </label>
                <input
                  type="date"
                  name="startDate"
                  required
                  min={todayIso()}
                  defaultValue={todayIso()}
                  className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  End date
                </label>
                <input
                  type="date"
                  name="endDate"
                  disabled={noEnd}
                  className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main disabled:opacity-50"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-text-body cursor-pointer">
              <input
                type="checkbox"
                name="noEnd"
                checked={noEnd}
                onChange={(e) => setNoEnd(e.target.checked)}
              />
              No end date
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-text-body cursor-pointer">
              <input type="checkbox" name="reminderEnabled" defaultChecked />
              Send reminder notifications
            </label>

            {state.error ? (
              <div className="text-[12.5px] text-danger">{state.error}</div>
            ) : null}

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="border-none bg-accent hover:bg-accent-hover text-white px-4.5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
