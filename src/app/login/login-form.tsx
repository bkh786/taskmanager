"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "./actions";
import type { LoginState } from "./types";
import { DigiPresenceLogo } from "@/components/brand/digipresence-logo";
import { AnimatedTitle } from "./animated-title";

const initialState: LoginState = { error: null };

export function LoginForm({ logoUrl }: { logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="w-full max-w-[400px]"
    >
      <div className="flex flex-col items-start gap-6 mb-9">
        <DigiPresenceLogo remoteLogoUrl={logoUrl} />
        <AnimatedTitle text="Task Manager" />
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
          className="mt-1.5 w-full py-3 text-white tm-signin rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>

    </form>
  );
}
