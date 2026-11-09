"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateUser } from "@/app/(app)/users/actions";
import type { Employee, DesignationItem } from "@/lib/org-data";
import type { AppUser } from "@/lib/auth";

const initialState = { error: null };

const ROLE_LABELS: Record<AppUser["system_role"], string> = {
  platform_owner: "Platform Owner",
  master_admin: "Org Admin",
  reporting_manager: "Reporting Manager",
  user: "Employee",
};

export function EditUserModal({
  target,
  projects,
  designations,
  managers,
  employees,
  canEditRole,
  allowedRoles,
  orgId,
  onClose,
}: {
  target: Employee;
  projects: { id: string; name: string }[];
  designations: DesignationItem[];
  managers: Employee[];
  employees: Employee[];
  canEditRole: boolean;
  allowedRoles: AppUser["system_role"][];
  orgId?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateUser, initialState);
  const submittedOnce = useRef(false);
  const [designationId, setDesignationId] = useState(target.designation_id ?? "");

  // Candidate managers: people holding the designation this one reports to.
  // With no mapping, fall back to all reporting managers.
  const dsg = designations.find((d) => d.id === designationId);
  const mappedParent = dsg?.reports_to_designation_id ?? null;
  const mappedRole = dsg?.reports_to_role ?? null;
  const mappedLabel = mappedParent
    ? (designations.find((d) => d.id === mappedParent)?.name ?? null)
    : mappedRole
      ? ROLE_LABELS[mappedRole]
      : null;
  const mapped = !!(mappedParent || mappedRole);
  const candidates = (mappedParent
    ? employees.filter((e) => e.designation_id === mappedParent && e.is_active)
    : mappedRole
      ? employees.filter((e) => e.system_role === mappedRole && e.is_active)
      : managers
  ).filter((m) => m.id !== target.id);
  // Keep the current manager selectable even if they no longer match.
  const current = target.reports_to ? employees.find((e) => e.id === target.reports_to) : undefined;
  const options =
    current && !candidates.some((c) => c.id === current.id) ? [current, ...candidates] : candidates;

  useEffect(() => {
    if (submittedOnce.current && !pending && state.error === null) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[420px] max-w-[calc(100vw-24px)] max-h-[88vh] overflow-y-auto bg-panel-bg rounded-xl px-6.5 py-6 shadow-xl">
        <div className="text-[16px] font-bold text-text-main mb-4">
          Edit {target.full_name}
        </div>
        <form
          action={(fd) => {
            submittedOnce.current = true;
            formAction(fd);
          }}
          className="flex flex-col gap-3.5"
        >
          <input type="hidden" name="userId" value={target.id} />
          {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Full name
            </label>
            <input
              name="fullName"
              required
              defaultValue={target.full_name}
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Employee code
            </label>
            <input
              name="employeeCode"
              required
              defaultValue={target.employee_code}
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Project
            </label>
            <select
              name="projectId"
              defaultValue={target.project_id ?? ""}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Designation
            </label>
            <select
              name="designationId"
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            >
              <option value="">None</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {canEditRole ? (
            <>
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue={target.system_role}
                  className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Reports to
                  {mappedLabel ? (
                    <span className="font-normal text-text-faint"> — {mappedLabel}</span>
                  ) : null}
                </label>
                <select
                  key={designationId}
                  name="reportsTo"
                  defaultValue={target.reports_to ?? ""}
                  className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                >
                  <option value="">No manager</option>
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                      {m.system_role === "user" ? " (Employee role)" : ""}
                    </option>
                  ))}
                </select>
                {!mapped ? (
                  <div className="text-[11px] text-text-faint mt-1">
                    No manager designation is mapped for this designation, so all reporting
                    managers are listed. Map one under Organization Settings → Project variables.
                  </div>
                ) : options.length === 0 ? (
                  <div className="text-[11px] text-danger mt-1">
                    Nobody currently matches {mappedLabel}.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <label className="flex items-center gap-2 text-[12.5px] text-text-body cursor-pointer">
            <input type="checkbox" name="isActive" defaultChecked={target.is_active} />
            Active
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
