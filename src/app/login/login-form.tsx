"use client";

import Link from "next/link";
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
      className="w-full max-w-[400px]"
    >
      <div className="flex flex-col items-start gap-4 mb-8">
        {branding?.logoUrl ? (
          // Natural aspect ratio, bounded by max-height/max-width -- logos
          // vary per org (square, circular, wide rectangular banners) and
          // shouldn't be cropped or squeezed into a fixed square tile.
          // eslint-disable-next-line @next/next/no-img-element -- per-tenant Storage URL, not a static/optimizable asset
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="max-h-16 max-w-[220px] w-auto h-auto object-contain"
          />
        ) : (
          <div className="w-12 h-12 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold text-[17px]">
            {branding ? branding.name.slice(0, 2).toUpperCase() : "TM"}
          </div>
        )}
        <div>
          <div className="text-[26px] font-extrabold text-text-main leading-tight">
            {branding?.name ?? "Task Manager"}
          </div>
          <div className="text-[14px] text-text-sub mt-1">
            Welcome back. Sign in to your workspace
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
            className="w-full px-3 py-3 border border-panel-border rounded-lg text-sm text-text-main bg-panel-bg"
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
            className="w-full px-3 py-3 border border-panel-border rounded-lg text-sm text-text-main bg-panel-bg"
          />
        </div>
        <div className="text-right -mt-1.5">
          <Link href="/forgot-password" className="text-[12.5px] font-semibold text-accent">
            Forgot password?
          </Link>
        </div>
        {state.error ? (
          <div className="text-[12.5px] text-danger">{state.error}</div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-1.5 w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>

      <div className="text-xs text-text-faint mt-6">
        Multi-tenant workspace · role is determined by your account
      </div>
    </form>
  );
}
