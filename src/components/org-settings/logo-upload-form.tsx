"use client";

import { useActionState, useRef } from "react";
import { uploadOrgLogo, type LogoFormState } from "@/app/(app)/org-settings/actions";

const initialState: LogoFormState = { error: null };

export function LogoUploadForm({
  logoUrl,
  orgId,
}: {
  logoUrl: string | null;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(uploadOrgLogo, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
      <div className="text-[14.5px] font-bold text-text-main mb-1">Login screen logo</div>
      <div className="text-[12.5px] text-text-sub mb-4">
        Shown alongside your organization name on the sign-in page. PNG, JPEG, WebP, or SVG, up
        to 2MB.
      </div>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[10px] border border-panel-border bg-chip-bg flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo is a user-uploaded Storage URL, not a static/optimizable asset
            <img src={logoUrl} alt="Organization logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[11px] text-text-faint">No logo</span>
          )}
        </div>
        <form
          ref={formRef}
          action={formAction}
          className="flex items-center gap-2.5"
        >
          {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            required
            onChange={() => formRef.current?.requestSubmit()}
            className="text-[12.5px] text-text-body"
          />
          {pending ? <span className="text-[12px] text-text-faint">Uploading…</span> : null}
        </form>
      </div>
      {state.error ? <div className="text-[12.5px] text-danger mt-3">{state.error}</div> : null}
    </div>
  );
}
