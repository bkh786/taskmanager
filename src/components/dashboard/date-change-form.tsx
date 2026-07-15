"use client";

import { useActionState, useState } from "react";
import { requestDateChange } from "@/app/(app)/dashboard/actions";
import { todayIso } from "@/lib/task-status";

const initialState = { error: null, success: false };

export function DateChangeForm({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    requestDateChange,
    initialState
  );

  if (state.success) {
    return (
      <div className="text-[12.5px] text-success bg-success-soft px-3 py-2.5 rounded-lg">
        Date change request sent to your manager.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer"
      >
        Request date change
      </button>
    );
  }

  return (
    <div className="bg-table-head-bg rounded-lg p-3.5">
      <div className="text-[12.5px] font-semibold text-text-body mb-2">
        Propose a new due date
      </div>
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="instanceId" value={instanceId} />
        <input
          type="date"
          name="newDate"
          required
          min={todayIso()}
          className="flex-1 px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Sending…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] cursor-pointer"
        >
          Cancel
        </button>
      </form>
      {state.error ? (
        <div className="text-[12px] text-danger mt-2">{state.error}</div>
      ) : null}
    </div>
  );
}
