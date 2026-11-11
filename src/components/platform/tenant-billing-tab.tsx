"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateInvoiceNow, saveTenantBilling, saveTenantManagement, type FormState } from "@/app/(app)/platform/actions";
import { PAYMENT_STATUSES, cycleLabel, formatMoney, paymentLabel, planChoices, type Discounts } from "@/lib/billing-shared";
import { fmtDate } from "@/lib/task-status";
import type { Tables } from "@/types/database.types";

const initial: FormState = { error: null, success: false };
const input = "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";
const card = "bg-panel-bg border border-panel-border rounded-[10px] p-5.5";
const primary = "border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60";

export function TenantBillingForm({ org, plans, discounts }: { org: Tables<"organizations">; plans: Tables<"plans">[]; discounts: Discounts }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveTenantBilling, initial);
  const [, startSave] = useTransition();
  const choices = planChoices(plans.filter((p) => p.is_active || p.id === org.plan_id), discounts);
  const [choice, setChoice] = useState(org.plan_id ? `${org.plan_id}|${org.billing_cycle ?? "monthly"}` : "");
  const [gen, startGen] = useTransition();
  const [genMsg, setGenMsg] = useState<string | null>(null);

  const picked = choices.find((c) => c.value === choice);

  return (
    <div className="flex flex-col gap-5">
      <div className={card}>
        <div className="text-[14.5px] font-bold text-text-main mb-3">Current plan</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
          <Stat k="Plan" v={org.plan} />
          <Stat k="Billing cycle" v={cycleLabel(org.billing_cycle)} />
          <Stat k="Next billing date" v={org.next_billing_date ? fmtDate(org.next_billing_date) : "—"} />
          <Stat k="Payment status" v={paymentLabel(org.payment_status)} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startSave(() => formAction(fd));
        }}
        className={`${card} flex flex-col gap-4`}
      >
        <input type="hidden" name="orgId" value={org.id} />
        <div className="text-[14.5px] font-bold text-text-main">Plan &amp; billing cycle</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Pricing plan &amp; billing cycle</label>
            <select name="planCycle" value={choice} onChange={(e) => setChoice(e.target.value)} className={input}>
              <option value="">No plan</option>
              {choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} — {formatMoney(c.price, c.plan.currency)}
                </option>
              ))}
            </select>
            {picked ? (
              <div className="text-[11px] text-text-faint mt-1">
                {formatMoney(picked.price, picked.plan.currency)} per {cycleLabel(picked.cycle).toLowerCase()} cycle
              </div>
            ) : null}
          </div>
          <div>
            <label className={label}>Billing cycle start date</label>
            <input type="date" name="billingStartDate" defaultValue={org.billing_start_date ?? ""} className={input} />
            <div className="text-[11px] text-text-faint mt-1">
              The first invoice and billing reminder go out on this date, then at the start of each cycle.
            </div>
          </div>
          <div>
            <label className={label}>Custom price per cycle (optional)</label>
            <input type="number" name="priceOverride" min={0} step="0.01" defaultValue={org.price_override ?? ""} placeholder={picked ? String(picked.price) : ""} className={input} />
            <div className="text-[11px] text-text-faint mt-1">Leave blank to bill the plan price.</div>
          </div>
          <div>
            <label className={label}>Payment status</label>
            <select name="paymentStatus" defaultValue={org.payment_status} className={input}>
              {PAYMENT_STATUSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Billing email (optional)</label>
            <input type="email" name="billingEmail" defaultValue={org.billing_email ?? ""} placeholder="Defaults to the org admin" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Billing notes</label>
          <textarea name="billingNotes" rows={2} defaultValue={org.billing_notes ?? ""} className={input} />
        </div>
        {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
        {state.success ? <div className="text-[12.5px] text-success">Billing saved.</div> : null}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={pending} className={primary}>
            {pending ? "Saving…" : "Save billing"}
          </button>
          <button
            type="button"
            disabled={gen || !org.plan_id}
            onClick={() =>
              startGen(async () => {
                const r = await generateInvoiceNow(org.id);
                setGenMsg(r.error ?? "Invoice generated and emailed.");
                router.refresh();
              })
            }
            className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] font-semibold cursor-pointer disabled:opacity-60"
          >
            {gen ? "Generating…" : "Generate invoice now"}
          </button>
          {genMsg ? <span className="text-[12.5px] text-text-sub">{genMsg}</span> : null}
        </div>
      </form>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-text-sub uppercase tracking-wide">{k}</div>
      <div className="text-[15px] font-bold text-text-main mt-0.5">{v}</div>
    </div>
  );
}

export function TenantManagementForm({ org, userCount }: { org: Tables<"organizations">; userCount: number }) {
  const [state, formAction, pending] = useActionState(saveTenantManagement, initial);
  const [, startSave] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => formAction(fd));
      }}
      className={`${card} flex flex-col gap-4`}
    >
      <input type="hidden" name="orgId" value={org.id} />
      <div className="text-[14.5px] font-bold text-text-main">Tenant management</div>
      <div className="text-[12.5px] text-text-sub">
        Upgrade the plan or billing under the Billing tab. Here you control seats and whether the tenant can sign in.
        Changes to the user limit are emailed to the org admin.
      </div>
      <div>
        <label className={label}>User limit (currently {userCount} used)</label>
        <input type="number" name="maxUsers" min={Math.max(1, userCount)} defaultValue={org.max_users ?? ""} placeholder="Unlimited" className={input} />
        <div className="text-[11px] text-text-faint mt-1">Extra seats beyond the plan&apos;s allowance are billed per the plan&apos;s extra-user price.</div>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-text-body cursor-pointer">
        <input type="checkbox" name="isActive" defaultChecked={org.is_active ?? true} />
        Tenant is active
      </label>
      <div>
        <label className={label}>Auto-deactivate on (optional)</label>
        <input type="date" name="autoDeactivateDate" defaultValue={org.auto_deactivate_date ?? ""} className={input} />
      </div>
      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? <div className="text-[12.5px] text-success">Saved.</div> : null}
      <div>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
