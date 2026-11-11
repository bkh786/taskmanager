"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePlan, type FormState } from "@/app/(app)/platform/actions";
import { BILLING_CYCLES, cycleLabel, formatMoney } from "@/lib/billing-shared";
import type { Tables } from "@/types/database.types";

export type PlanRow = Tables<"plans"> & { tenantCount: number };

const initial: FormState = { error: null, success: false };
const input = "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";
const th = "text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap";
const td = "px-4 py-2.5 border-b border-row-hover-border text-[13px] text-text-body";

export function PlanMaster({ plans }: { plans: PlanRow[] }) {
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="text-[22px] font-bold text-text-main">Plan Master</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Plans, their pricing and billing cycle. Each tenant is billed on the plan chosen for it.
          </div>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer"
        >
          + New plan
        </button>
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              <th className={th}>Plan</th>
              <th className={th}>Price</th>
              <th className={th}>Billing cycle</th>
              <th className={th}>Users included</th>
              <th className={th}>Extra user</th>
              <th className={th}>Tenants</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  No plans yet.
                </td>
              </tr>
            ) : (
              plans.map((p) => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.6 }}>
                  <td className={td}>
                    <div className="font-semibold text-text-main">{p.name}</div>
                    {p.description ? <div className="text-[12px] text-text-sub">{p.description}</div> : null}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatMoney(p.price, p.currency)}</td>
                  <td className={td}>{cycleLabel(p.billing_cycle)}</td>
                  <td className={td}>{p.included_users ?? "Unlimited"}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {Number(p.extra_user_price) > 0 ? formatMoney(p.extra_user_price, p.currency) : "—"}
                  </td>
                  <td className={td}>{p.tenantCount}</td>
                  <td className={td}>{p.is_active ? "Active" : "Inactive"}</td>
                  <td className={`${td} text-right`}>
                    <button
                      onClick={() => setEditing(p)}
                      className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? <PlanModal plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function PlanModal({ plan, onClose }: { plan: PlanRow | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(savePlan, initial);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[480px] max-w-[calc(100vw-24px)] max-h-[88vh] overflow-y-auto bg-panel-bg rounded-xl px-6.5 py-6 shadow-xl">
        <div className="text-[16px] font-bold text-text-main mb-4">{plan ? `Edit ${plan.name}` : "New plan"}</div>
        <form
          action={(fd) => {
            submitted.current = true;
            formAction(fd);
          }}
          className="flex flex-col gap-3.5"
        >
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          <div>
            <label className={label}>Plan name *</label>
            <input name="name" required defaultValue={plan?.name ?? ""} className={input} />
          </div>
          <div>
            <label className={label}>Description</label>
            <input name="description" defaultValue={plan?.description ?? ""} className={input} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className={label}>Price per cycle *</label>
              <input type="number" name="price" min={0} step="0.01" required defaultValue={plan?.price ?? 0} className={input} />
            </div>
            <div>
              <label className={label}>Currency</label>
              <input name="currency" maxLength={3} defaultValue={plan?.currency ?? "INR"} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Billing cycle *</label>
            <select name="billingCycle" defaultValue={plan?.billing_cycle ?? "monthly"} className={input}>
              {BILLING_CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={label}>Users included</label>
              <input type="number" name="includedUsers" min={1} placeholder="Unlimited" defaultValue={plan?.included_users ?? ""} className={input} />
            </div>
            <div>
              <label className={label}>Price per extra user</label>
              <input type="number" name="extraUserPrice" min={0} step="0.01" defaultValue={plan?.extra_user_price ?? 0} className={input} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-text-body cursor-pointer">
            <input type="checkbox" name="isActive" defaultChecked={plan?.is_active ?? true} />
            Active (available to assign to tenants)
          </label>
          {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="border-none bg-accent hover:bg-accent-hover text-white px-4.5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60">
              {pending ? "Saving…" : "Save plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
