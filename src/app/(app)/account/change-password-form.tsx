"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import type { ChangePasswordState } from "./types";

const initialState: ChangePasswordState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState
  );

  return (
    <form
      action={formAction}
      className="bg-panel-bg border border-panel-border rounded-[10px] p-[22px] max-w-[420px] flex flex-col gap-3.5"
    >
      <div>
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          Current password
        </label>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm bg-panel-bg text-text-main"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          New password
        </label>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm bg-panel-bg text-text-main"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          Confirm new password
        </label>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm bg-panel-bg text-text-main"
        />
      </div>
      {state.error ? (
        <div className="text-[12.5px] text-danger">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="text-[12.5px] text-success">Password updated.</div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-md text-sm font-semibold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
