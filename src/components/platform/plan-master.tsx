"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { savePlan, saveDiscounts, type FormState } from "@/app/(app)/platform/actions";
import { formatMoney, planCyclePrice, type Discounts } from "@/lib/billing-shared";
import type { Tables } from "@/types/database.types";

export type PlanRow = Tables<"plans"> & { tenantCount: number };

const initial: FormState = { error: null, success: false };
const input = "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";
const th = "text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap";
const td = "px-4 py-2.5 border-b border-row-hover-border text-[13px] text-text-body";

export function PlanMaster({ plans, discounts }: { plans: PlanRow[]; discounts: Discounts }) {
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [disc, setDisc] = useState({
    quarterly: String(discounts.quarterly),
    semi_annual: String(discounts.semi_annual),
    annual: String(discounts.annual),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const live: Discounts = {
    quarterly: Number(disc.quarterly) || 0,
    semi_annual: Number(disc.semi_annual) || 0,
    annual: Number(disc.annual) || 0,
  };

  function saveDisc() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(disc)) fd.set(k, v);
    setMsg(null);
    startSaving(async () => {
      const r = await saveDiscounts(initial, fd);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Discounts saved." });
    });
  }

  const money = (plan: PlanRow, cycle: string) => {
    const p = planCyclePrice(plan, cycle, live);
    return p === null ? "—" : formatMoney(p, plan.currency);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="text-[22px] font-bold text-text-main">Plan Master</div>
          <div className="text-[13.5px] text-text-sub mt-1">
            Enter the monthly (and one-time) price. Quarterly, semi-annual and annual prices are calculated as monthly × months × (1 − discount %).
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
            <tr>
              <th colSpan={4} className="text-right px-4 py-2 text-[12.5px] font-semibold text-text-sub border-b border-panel-border">
                Discount applicable »
              </th>
              {(
                [
                  ["quarterly", "Quarterly"],
                  ["semi_annual", "Semi-annual"],
                  ["annual", "Annual"],
                ] as const
              ).map(([k, l]) => (
                <th key={k} className="px-3 py-2 border-b border-panel-border" style={{ background: "var(--accent-soft)" }}>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      aria-label={`${l} discount %`}
                      value={disc[k]}
                      onChange={(e) => setDisc((d) => ({ ...d, [k]: e.target.value }))}
                      className="w-[72px] px-2 py-1 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                    />
                    <span className="text-[13px] text-text-main">%</span>
                  </div>
                </th>
              ))}
              <th colSpan={3} className="text-left px-4 py-2 border-b border-panel-border">
                <button
                  onClick={saveDisc}
                  disabled={saving}
                  className="border border-panel-border bg-panel-bg text-text-body px-3 py-1 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save discounts"}
                </button>
                {msg ? <span className={`ml-2 text-[12px] ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span> : null}
              </th>
            </tr>
            <tr className="bg-table-head-bg">
              <th className={th}>Plan</th>
              <th className={th}>Users included</th>
              <th className={th}>Price per extra user</th>
              <th className={th}>Monthly price</th>
              <th className={th}>Quarterly price (×3)</th>
              <th className={th}>Semi-annual price (×6)</th>
              <th className={th}>Annual price (×12)</th>
              <th className={th}>One-time price</th>
              <th className={th}>Tenants</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-[13px] text-text-faint">
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
                  <td className={td}>{p.included_users ?? "Unlimited"}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {Number(p.extra_user_price) > 0 ? formatMoney(p.extra_user_price, p.currency) : "—"}
                  </td>
                  <td className={`${td} whitespace-nowrap font-semibold text-text-main`}>{money(p, "monthly")}</td>
                  <td className={`${td} whitespace-nowrap`}>{money(p, "quarterly")}</td>
                  <td className={`${td} whitespace-nowrap`}>{money(p, "semi_annual")}</td>
                  <td className={`${td} whitespace-nowrap`}>{money(p, "annual")}</td>
                  <td className={`${td} whitespace-nowrap`}>{money(p, "one_time")}</td>
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
              <label className={label}>Monthly price *</label>
              <input type="number" name="price" min={0} step="0.01" required defaultValue={plan?.price ?? 0} className={input} />
            </div>
            <div>
              <label className={label}>Currency</label>
              <input name="currency" maxLength={3} defaultValue={plan?.currency ?? "INR"} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>One-time price (optional)</label>
            <input type="number" name="oneTimePrice" min={0} step="0.01" placeholder="Leave blank if not offered" defaultValue={plan?.one_time_price ?? ""} className={input} />
            <div className="text-[11px] text-text-faint mt-1">Quarterly, semi-annual and annual prices are calculated from the monthly price and the discounts.</div>
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
