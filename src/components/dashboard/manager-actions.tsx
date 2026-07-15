"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  transferTaskInstance,
  removeTaskInstance,
  type FormState,
} from "@/app/(app)/tasks/[id]/actions";
import type { Employee } from "@/lib/org-data";

const initialState: FormState = { error: null };

const REASON_CODES = ["Leave", "Attrition", "Other"] as const;

export function ManagerActions({
  instanceId,
  currentAssigneeId,
  employees,
}: {
  instanceId: string;
  currentAssigneeId: string | null;
  employees: Employee[];
}) {
  const [panel, setPanel] = useState<"none" | "transfer" | "delete">("none");
  const router = useRouter();

  const [transferState, transferAction, transferPending] = useActionState(
    transferTaskInstance,
    initialState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: typeof initialState, fd: FormData) => {
      const result = await removeTaskInstance(prev, fd);
      if (!result.error) router.push("/dashboard");
      return result;
    },
    initialState
  );

  const transferSubmitted = useRef(false);
  useEffect(() => {
    if (transferSubmitted.current && !transferPending && transferState.error === null) {
      setPanel("none");
      transferSubmitted.current = false;
    }
  }, [transferPending, transferState]);

  const [scope, setScope] = useState<"instance" | "task">("instance");

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5 mt-4">
      <div className="text-[14.5px] font-bold text-text-main mb-3.5">
        Manager actions
      </div>

      {panel === "none" ? (
        <div className="flex gap-2.5">
          <button
            onClick={() => setPanel("transfer")}
            className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer"
          >
            Transfer
          </button>
          <button
            onClick={() => setPanel("delete")}
            className="border border-panel-border bg-panel-bg text-danger px-3.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer"
          >
            Remove
          </button>
        </div>
      ) : null}

      {panel === "transfer" ? (
        <form
          action={(fd) => {
            transferSubmitted.current = true;
            transferAction(fd);
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="instanceId" value={instanceId} />
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              New assignee
            </label>
            <select
              name="newAssigneeId"
              required
              defaultValue=""
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            >
              <option value="" disabled>
                Select…
              </option>
              {employees
                .filter((e) => e.id !== currentAssigneeId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Reason (optional)
            </label>
            <input
              name="reason"
              placeholder="e.g. Workload rebalancing"
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
          {transferState.error ? (
            <div className="text-[12.5px] text-danger">{transferState.error}</div>
          ) : null}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferPending}
              className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-60"
            >
              {transferPending ? "Transferring…" : "Confirm transfer"}
            </button>
          </div>
        </form>
      ) : null}

      {panel === "delete" ? (
        <form action={deleteAction} className="flex flex-col gap-3">
          <input type="hidden" name="instanceId" value={instanceId} />
          <div className="flex bg-chip-bg rounded-lg p-[3px] gap-0.5">
            <button
              type="button"
              onClick={() => setScope("instance")}
              className="flex-1 border-none py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer"
              style={{
                background: scope === "instance" ? "var(--panel-bg)" : "transparent",
                color: scope === "instance" ? "var(--accent)" : "var(--text-body)",
              }}
            >
              This occurrence
            </button>
            <button
              type="button"
              onClick={() => setScope("task")}
              className="flex-1 border-none py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer"
              style={{
                background: scope === "task" ? "var(--panel-bg)" : "transparent",
                color: scope === "task" ? "var(--accent)" : "var(--text-body)",
              }}
            >
              Entire task
            </button>
          </div>
          <input type="hidden" name="scope" value={scope} />
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Reason
            </label>
            <select
              name="reasonCode"
              required
              defaultValue=""
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            >
              <option value="" disabled>
                Select a reason…
              </option>
              {REASON_CODES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Details (optional)
            </label>
            <textarea
              name="reasonDetail"
              rows={2}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main resize-y"
            />
          </div>
          {deleteState.error ? (
            <div className="text-[12.5px] text-danger">{deleteState.error}</div>
          ) : null}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-2 rounded-md text-[13px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deletePending}
              className="border-none bg-danger text-white px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-60"
            >
              {deletePending ? "Removing…" : "Confirm removal"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
