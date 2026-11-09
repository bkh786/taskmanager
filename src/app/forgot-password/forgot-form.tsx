"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "./actions";

const initialState: ForgotState = { error: null, done: false };

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form
      action={formAction}
      className="w-[380px] max-w-[calc(100vw-24px)] bg-panel-bg border border-panel-border rounded-xl px-8 py-9 shadow-sm"
    >
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[17px]">
          TM
        </div>
        <div className="text-center">
          <div className="text-[18px] font-bold text-text-main">Reset your password</div>
          <div className="text-[13px] text-text-sub mt-0.5">
            Enter your work email and we&apos;ll send you a link.
          </div>
        </div>
      </div>

      {state.done ? (
        <div className="flex flex-col gap-4">
          <div className="text-[13px] text-text-body bg-table-head-bg border border-panel-border rounded-md px-3 py-3">
            If an account exists for that email, a reset link is on its way. It can take a
            minute or two, and it&apos;s valid for one hour.
          </div>
          <Link href="/login" className="text-center text-[13px] font-semibold text-accent">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              placeholder="you@company.com"
              className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm text-text-main bg-panel-bg"
            />
          </div>
          {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1.5 w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-md text-sm font-semibold cursor-pointer disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/login" className="text-center text-[13px] text-text-sub">
            Back to sign in
          </Link>
        </div>
      )}
    </form>
  );
}
