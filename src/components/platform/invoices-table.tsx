"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment, resendInvoice, runBillingNow, voidInvoice } from "@/app/(app)/platform/actions";
import { cycleLabel, formatMoney } from "@/lib/billing-shared";
import { fmtDate } from "@/lib/task-status";
import type { Tables } from "@/types/database.types";

export type InvoiceRow = Tables<"invoices"> & { org_name?: string };

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: "var(--success-soft)", color: "var(--success)" },
  pending: { bg: "var(--accent-soft)", color: "var(--accent)" },
  overdue: { bg: "var(--danger-soft)", color: "var(--danger)" },
  void: { bg: "var(--chip-bg)", color: "var(--text-faint)" },
};

const th = "text-left px-4 py-2.5 text-[11.5px] font-bold text-text-sub uppercase border-b border-panel-border whitespace-nowrap";
const td = "px-4 py-2.5 border-b border-row-hover-border text-[13px] text-text-body whitespace-nowrap";
const input = "px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main";

export function InvoicesTable({ invoices, showTenant }: { invoices: InvoiceRow[]; showTenant?: boolean }) {
  const router = useRouter();
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMessage(null);
    start(async () => {
      const r = await fn();
      setMessage(r.error ?? ok);
      router.refresh();
    });
  }

  return (
    <div>
      {message ? <div className="text-[12.5px] text-text-sub mb-2">{message}</div> : null}
      <div className="bg-panel-bg border border-panel-border rounded-[10px] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-table-head-bg">
              <th className={th}>Invoice</th>
              {showTenant ? <th className={th}>Tenant</th> : null}
              <th className={th}>Plan</th>
              <th className={th}>Period</th>
              <th className={th}>Amount</th>
              <th className={th}>Due</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-text-faint">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((i) => {
                const st = STATUS_STYLE[i.status] ?? STATUS_STYLE.pending;
                const open = i.status === "pending" || i.status === "overdue";
                return (
                  <tr key={i.id}>
                    <td className={`${td} font-semibold text-text-main`}>{i.invoice_number}</td>
                    {showTenant ? (
                      <td className={td}>
                        <Link href={`/tenants/${i.org_id}?tab=billing`} className="text-accent font-semibold">
                          {i.org_name ?? "—"}
                        </Link>
                      </td>
                    ) : null}
                    <td className={td}>
                      {i.plan_name ?? "—"} · {cycleLabel(i.billing_cycle)}
                    </td>
                    <td className={td}>
                      {fmtDate(i.period_start)}
                      {i.period_end ? ` – ${fmtDate(i.period_end)}` : ""}
                    </td>
                    <td className={td}>{formatMoney(i.amount, i.currency)}</td>
                    <td className={td}>{fmtDate(i.due_on)}</td>
                    <td className={td}>
                      <span className="text-xs font-semibold px-2.5 py-[3px] rounded-[5px] capitalize" style={{ background: st.bg, color: st.color }}>
                        {i.status}
                      </span>
                      {i.status === "paid" && i.paid_on ? <span className="ml-2 text-[11.5px] text-text-faint">{fmtDate(i.paid_on)}</span> : null}
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex gap-1.5 justify-end">
                        {open ? (
                          <button disabled={pending} onClick={() => setPaying(i)} className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer">
                            Mark paid
                          </button>
                        ) : null}
                        {i.status !== "void" ? (
                          <button disabled={pending} onClick={() => act(() => resendInvoice(i.id), "Invoice email sent.")} className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer">
                            Resend
                          </button>
                        ) : null}
                        {open ? (
                          <button
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Void invoice ${i.invoice_number}?`)) act(() => voidInvoice(i.id), "Invoice voided.");
                            }}
                            className="border border-panel-border bg-panel-bg text-danger px-2.5 py-1 rounded-md text-xs cursor-pointer"
                          >
                            Void
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {paying ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            action={(fd) =>
              start(async () => {
                const r = await recordPayment(fd);
                setMessage(r.error ?? "Payment recorded and receipt emailed.");
                if (!r.error) setPaying(null);
                router.refresh();
              })
            }
            className="w-[400px] max-w-[calc(100vw-24px)] bg-panel-bg rounded-xl px-6 py-6 shadow-xl flex flex-col gap-3.5"
          >
            <div className="text-[16px] font-bold text-text-main">Record payment · {paying.invoice_number}</div>
            <div className="text-[13px] text-text-sub">{formatMoney(paying.amount, paying.currency)}</div>
            <input type="hidden" name="invoiceId" value={paying.id} />
            <label className="text-xs font-semibold text-text-sub">
              Paid on
              <input type="date" name="paidOn" defaultValue={new Date().toISOString().slice(0, 10)} className={`${input} w-full mt-1.5`} />
            </label>
            <label className="text-xs font-semibold text-text-sub">
              Payment method
              <select name="method" className={`${input} w-full mt-1.5`}>
                <option>Bank transfer</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Cheque</option>
                <option>Cash</option>
                <option>Other</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-text-sub">
              Reference / transaction id
              <input name="reference" className={`${input} w-full mt-1.5`} />
            </label>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setPaying(null)} className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="border-none bg-accent hover:bg-accent-hover text-white px-4.5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60">
                Save payment
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function RunBillingButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {msg ? <span className="text-[12.5px] text-text-sub">{msg}</span> : null}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runBillingNow();
            setMsg(r.error ? `${r.message} Errors: ${r.error}` : r.message);
            router.refresh();
          })
        }
        className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Running…" : "Run billing now"}
      </button>
    </div>
  );
}
