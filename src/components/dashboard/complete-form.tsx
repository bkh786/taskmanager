"use client";

import { useActionState, useState } from "react";
import { completeTaskInstance } from "@/app/(app)/dashboard/actions";

const initialState = { error: null };

export function CompleteForm({ instanceId }: { instanceId: string }) {
  const [state, formAction, pending] = useActionState(
    completeTaskInstance,
    initialState
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
      <div className="text-[14.5px] font-bold text-text-main mb-3.5">
        Complete this task
      </div>
      <form action={formAction} className="flex flex-col gap-1.5">
        <input type="hidden" name="instanceId" value={instanceId} />
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          Comment (optional)
        </label>
        <textarea
          name="comment"
          rows={3}
          placeholder="Add any notes for your manager…"
          className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main resize-y mb-3.5"
        />
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          Proof of completion (required)
        </label>
        <div className="border-[1.5px] border-dashed border-panel-border rounded-lg p-4 text-center mb-1.5">
          <input
            type="file"
            name="file"
            required
            accept="image/*,application/pdf"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="text-[12.5px] text-text-body"
          />
        </div>
        {fileName ? (
          <div className="text-xs text-success mb-2.5">✓ {fileName} attached</div>
        ) : null}
        {state.error ? (
          <div className="text-[12.5px] text-danger mb-1">{state.error}</div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full border-none py-2.5 rounded-md text-[13.5px] font-bold mt-1.5 bg-accent hover:bg-accent-hover text-white cursor-pointer disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Mark Complete"}
        </button>
      </form>
    </div>
  );
}
