"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createOrReplaceUser } from "@/app/(app)/users/actions";
import type { Employee } from "@/lib/org-data";
import type { AppUser } from "@/lib/auth";

const initialState = { error: null };

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

export function UserModal({
  employees,
  managers,
  allowedRoles,
  showReportsTo,
  presetTarget,
  orgId,
  onClose,
}: {
  employees: Employee[];
  managers: Employee[];
  allowedRoles: AppUser["system_role"][];
  showReportsTo: boolean;
  presetTarget: Employee | null;
  orgId?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"new_hire" | "replacing">(
    presetTarget ? "replacing" : "new_hire"
  );
  const [replacingId, setReplacingId] = useState(presetTarget?.id ?? "");
  const [state, formAction, pending] = useActionState(
    createOrReplaceUser,
    initialState
  );
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (submittedOnce.current && !pending && state.error === null) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[440px] max-h-[88vh] overflow-y-auto bg-panel-bg rounded-xl px-6.5 py-6 shadow-xl">
        <div className="text-[16px] font-bold text-text-main mb-1">
          {presetTarget ? `Replace ${presetTarget.full_name}` : "Add User"}
        </div>
        <div className="text-[13px] text-text-sub mb-4">
          Is this a new hire, or a replacement for an existing role?
        </div>

        <div className="flex gap-2.5 mb-4.5">
          <button
            type="button"
            onClick={() => setMode("new_hire")}
            className="flex-1 rounded-lg p-3.5 cursor-pointer text-center"
            style={{
              border: `1.5px solid ${mode === "new_hire" ? "var(--accent)" : "var(--panel-border)"}`,
              background: mode === "new_hire" ? "var(--accent-soft)" : "transparent",
            }}
          >
            <div className="text-[13px] font-bold text-text-main">New hire</div>
            <div className="text-[11px] text-text-sub mt-0.5">Fresh onboarding</div>
          </button>
          <button
            type="button"
            onClick={() => setMode("replacing")}
            className="flex-1 rounded-lg p-3.5 cursor-pointer text-center"
            style={{
              border: `1.5px solid ${mode === "replacing" ? "var(--accent)" : "var(--panel-border)"}`,
              background: mode === "replacing" ? "var(--accent-soft)" : "transparent",
            }}
          >
            <div className="text-[13px] font-bold text-text-main">Replacement</div>
            <div className="text-[11px] text-text-sub mt-0.5">Reassign existing tasks</div>
          </button>
        </div>

        <form
          action={(fd) => {
            submittedOnce.current = true;
            formAction(fd);
          }}
          className="flex flex-col gap-3.5"
        >
          <input type="hidden" name="mode" value={mode} />
          {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}

          {mode === "replacing" ? (
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Who are they replacing?
              </label>
              <select
                name="replacingUserId"
                required
                value={replacingId}
                onChange={(e) => setReplacingId(e.target.value)}
                className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
              >
                <option value="">Select an employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-text-faint mt-1.5">
                Their open task instances (due today or later) will be reassigned to the new hire.
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Full name
            </label>
            <input
              name="fullName"
              required
              placeholder="Jordan Blake"
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="jordan.blake@acme.com"
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Default password
            </label>
            <input
              type="text"
              name="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
            <div className="text-[11px] text-text-faint mt-1">
              They can change it after their first sign-in.
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Role
            </label>
            <select
              name="role"
              required
              defaultValue={allowedRoles[0]}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {showReportsTo ? (
            <div>
              <label className="text-xs font-semibold text-text-sub block mb-1.5">
                Reports to (optional)
              </label>
              <select
                name="reportsTo"
                defaultValue=""
                className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
              >
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
              {pending ? "Saving…" : mode === "replacing" ? "Confirm" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
