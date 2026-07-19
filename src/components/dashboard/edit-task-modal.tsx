"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTask, type UpdateTaskState } from "@/app/(app)/tasks/[id]/actions";

const initialState: UpdateTaskState = { error: null };

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export type EditableTask = {
  id: string;
  taskName: string;
  description: string | null;
  isRecurring: boolean;
  recurrenceKind: "one_time" | "daily" | "weekly" | "monthly";
  recurrenceInterval: number;
  excludedWeekdays: number[];
  startDate: string;
  endDate: string | null;
  reminderEnabled: boolean;
  endDateFloor: string;
};

export function EditTaskModal({
  task,
  onClose,
}: {
  task: EditableTask;
  onClose: () => void;
}) {
  const [recurring, setRecurring] = useState(task.isRecurring);
  const [kind, setKind] = useState<"daily" | "weekly" | "monthly">(
    task.recurrenceKind === "one_time" ? "daily" : task.recurrenceKind
  );
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>(
    task.excludedWeekdays
  );
  const [noEnd, setNoEnd] = useState(!task.endDate);
  const [state, formAction, pending] = useActionState(updateTask, initialState);
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (submittedOnce.current && !pending && state.error === null) {
      onClose();
      submittedOnce.current = false;
    }
  }, [pending, state, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[480px] max-h-[88vh] overflow-y-auto bg-panel-bg rounded-xl px-7 py-6 shadow-xl">
        <div className="text-[16.5px] font-bold text-text-main mb-4.5">
          Edit Task
        </div>
        <form
          action={(fd) => {
            submittedOnce.current = true;
            formAction(fd);
          }}
          className="flex flex-col gap-3.5"
        >
          <input type="hidden" name="taskId" value={task.id} />
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Task name
            </label>
            <input
              name="taskName"
              required
              defaultValue={task.taskName}
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
              defaultValue={task.description ?? ""}
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main resize-y"
            />
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
              name="recurrenceKind"
              value={recurring ? kind : "one_time"}
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
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-text-body">Every</span>
                <input
                  type="number"
                  name="recurrenceInterval"
                  min={1}
                  defaultValue={task.recurrenceInterval}
                  className="w-14 px-2 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                />
                <span className="text-[12.5px] text-text-body">
                  {kind === "daily" ? "day(s)" : kind === "weekly" ? "week(s)" : "month(s)"}
                </span>
              </div>
              <div className="text-[11px] text-text-faint">
                Changing the schedule only affects future, not-yet-completed
                occurrences -- past and completed ones are untouched.
              </div>

              {kind === "daily" ? (
                <div>
                  <div className="text-[12.5px] text-text-body mb-1.5">
                    Skip these days (optional)
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEKDAYS.map((w) => {
                      const checked = excludedWeekdays.includes(w.value);
                      return (
                        <label
                          key={w.value}
                          className="flex items-center gap-1 text-[11.5px] text-text-body cursor-pointer border border-panel-border rounded-md px-2 py-1"
                          style={{
                            background: checked ? "var(--accent-soft)" : "var(--panel-bg)",
                            borderColor: checked ? "var(--accent)" : "var(--panel-border)",
                          }}
                        >
                          <input
                            type="checkbox"
                            name="excludedWeekdays"
                            value={w.value}
                            checked={checked}
                            onChange={(e) =>
                              setExcludedWeekdays((prev) =>
                                e.target.checked
                                  ? [...prev, w.value]
                                  : prev.filter((d) => d !== w.value)
                              )
                            }
                            className="sr-only"
                          />
                          {w.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              End date
            </label>
            <input
              type="date"
              name="endDate"
              disabled={noEnd}
              min={task.endDateFloor}
              defaultValue={task.endDate ?? ""}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main disabled:opacity-50"
            />
            <div className="text-[11px] text-text-faint mt-1">
              Can&rsquo;t be set before {task.endDateFloor} -- an instance for
              that date already exists or has been completed.
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
            <input
              type="checkbox"
              name="reminderEnabled"
              defaultChecked={task.reminderEnabled}
            />
            Send reminder notifications
          </label>

          {state.error ? (
            <div className="text-[12.5px] text-danger">{state.error}</div>
          ) : null}

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="border-none bg-accent hover:bg-accent-hover text-white px-4.5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
