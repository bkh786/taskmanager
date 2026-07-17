"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import type { LoginState } from "./types";
import type { OrgBranding } from "./page";

const initialState: LoginState = { error: null };

export function LoginForm({ branding }: { branding: OrgBranding | null }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="w-[380px] bg-panel-bg border border-panel-border rounded-xl px-8 py-9 shadow-sm"
    >
      <div className="flex flex-col items-center gap-3 mb-7">
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- per-tenant Storage URL, not a static/optimizable asset
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="w-12 h-12 rounded-[10px] object-contain"
          />
        ) : (
          <div className="w-12 h-12 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[17px]">
            {branding ? branding.name.slice(0, 2).toUpperCase() : "TM"}
          </div>
        )}
        <div className="text-center">
          <div className="text-[18px] font-bold text-text-main">
            {branding?.name ?? "Task Manager"}
          </div>
          <div className="text-[13px] text-text-sub mt-0.5">
            Sign in to your workspace
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div>
          <label className="text-xs font-semibold text-text-sub block mb-1.5">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            placeholder="you@company.com"
            className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm text-text-main bg-panel-bg"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-sub block mb-1.5">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-2.5 py-2.5 border border-panel-border rounded-md text-sm text-text-main bg-panel-bg"
          />
        </div>
        {state.error ? (
          <div className="text-[12.5px] text-danger">{state.error}</div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-1.5 w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-md text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>

      <div className="text-center text-xs text-text-faint mt-5">
        Multi-tenant workspace · role is determined by your account
      </div>
    </form>
  );
}
