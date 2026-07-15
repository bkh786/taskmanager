"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTenant, type TenantFormState } from "@/app/(app)/tenants/actions";

const initialState: TenantFormState = { error: null };

export function NewTenantModal() {
  const [open, setOpen] = useState(false);
  const [useInactiveDate, setUseInactiveDate] = useState(false);
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [state, formAction, pending] = useActionState(createTenant, initialState);
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (submittedOnce.current && !pending && state.error === null) {
      setOpen(false);
      submittedOnce.current = false;
    }
  }, [pending, state]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap"
      >
        + New Tenant
      </button>
      {open ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-[480px] max-h-[88vh] overflow-y-auto bg-panel-bg rounded-xl px-6.5 py-6 shadow-xl">
            <div className="text-[16px] font-bold text-text-main mb-1">
              New Tenant
            </div>
            <div className="text-[13px] text-text-sub mb-4">
              Provision a new organization and its first admin.
            </div>
            <form
              action={(fd) => {
                submittedOnce.current = true;
                formAction(fd);
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Organization name
                </label>
                <input
                  name="orgName"
                  required
                  placeholder="Acme Corporation"
                  className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Admin name
                </label>
                <input
                  name="adminName"
                  required
                  placeholder="Priya Nair"
                  className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Admin email
                </label>
                <input
                  type="email"
                  name="adminEmail"
                  required
                  placeholder="admin@acme.com"
                  className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                />
                <div className="text-[11px] text-text-faint mt-1">
                  They&apos;ll get an email to set their password.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-text-sub block mb-1.5">
                    Plan
                  </label>
                  <select
                    name="plan"
                    defaultValue="Starter"
                    className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                  >
                    <option>Starter</option>
                    <option>Business</option>
                    <option>Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-sub block mb-1.5">
                    Max user count
                  </label>
                  <input
                    type="number"
                    name="maxUsers"
                    min={1}
                    defaultValue={25}
                    className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Initial project name (optional)
                </label>
                <input
                  name="projectName"
                  placeholder="e.g. Website Revamp"
                  className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                />
              </div>

              <div className="bg-table-head-bg rounded-lg p-3.5">
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Tenant status
                </label>
                <div className="flex bg-panel-bg border border-panel-border rounded-lg p-[3px] gap-0.5 mb-2.5">
                  {(["Active", "Inactive"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className="flex-1 border-none py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer"
                      style={{
                        background: status === s ? "var(--accent-soft)" : "transparent",
                        color: status === s ? "var(--accent)" : "var(--text-body)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="status" value={status} />
                <label className="flex items-center gap-2 text-[12.5px] text-text-body mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="useInactiveDate"
                    checked={useInactiveDate}
                    onChange={(e) => setUseInactiveDate(e.target.checked)}
                  />
                  Schedule auto-deactivation on a specific date
                </label>
                {useInactiveDate ? (
                  <input
                    type="date"
                    name="inactiveDate"
                    className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                  />
                ) : null}
              </div>

              <div>
                <label className="text-xs font-semibold text-text-sub block mb-1.5">
                  Billing status
                </label>
                <select
                  name="billingStatus"
                  defaultValue="Trial"
                  className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
                >
                  <option>Paid</option>
                  <option>Trial</option>
                  <option>Overdue</option>
                  <option>Cancelled</option>
                </select>
              </div>

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
                  {pending ? "Creating…" : "Create Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
