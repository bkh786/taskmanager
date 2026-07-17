"use client";

import { useActionState, useState } from "react";
import { updateLoginDomain, type DomainFormState } from "@/app/(app)/org-settings/actions";

const initialState: DomainFormState = { error: null };

export function LoginLinkForm({
  domain,
  slug,
  defaultDomain,
  orgId,
}: {
  domain: string | null;
  slug: string;
  defaultDomain: string;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(updateLoginDomain, initialState);
  const [value, setValue] = useState(domain ?? defaultDomain);
  const [copied, setCopied] = useState(false);

  // Sync the displayed value to the server-normalized domain (e.g. a
  // missing "https://" prefix gets added) once a save succeeds. Adjusted
  // during render (React's recommended pattern for this) rather than in an
  // effect, so it takes effect in the same render pass instead of a flash.
  const [lastSyncedDomain, setLastSyncedDomain] = useState(state.domain);
  if (state.domain !== lastSyncedDomain) {
    setLastSyncedDomain(state.domain);
    if (state.domain) setValue(state.domain);
  }

  const fullUrl = `${value.replace(/\/+$/, "")}/login?org=${slug}`;

  function copy() {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
      <div className="text-[14.5px] font-bold text-text-main mb-1">Your login link</div>
      <div className="text-[12.5px] text-text-sub mb-3">
        Set the domain your team should use to sign in — useful if this app is hosted on your
        own domain. Only the domain is editable; the <code>/login?org=…</code> path is fixed to
        your organization.
      </div>
      <form action={formAction} className="flex items-center gap-2 mb-3">
        {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}
        <input
          name="domain"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://tasks.yourcompany.com"
          className="flex-1 px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-none bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-[12.5px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {state.error ? <div className="text-[12px] text-danger mb-2">{state.error}</div> : null}

      <code className="flex items-center justify-between gap-3 text-[12.5px] text-accent bg-chip-bg px-3 py-2 rounded-md">
        <span className="break-all">{fullUrl}</span>
        <button
          type="button"
          onClick={copy}
          className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </code>
    </div>
  );
}
