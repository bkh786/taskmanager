"use client";

import { useActionState, useState, useTransition } from "react";
import { updateEmailOptions, type SettingsFormState } from "@/app/(app)/org-settings/actions";
import type { OrgSettingsOrg } from "./settings-form";

const initialState: SettingsFormState = { error: null, success: false };

const input =
  "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";

/** Signature, daily reminder time and the fixed addresses copied on every email. */
export function EmailOptionsForm({ org, orgId }: { org: OrgSettingsOrg; orgId?: string }) {
  const [state, formAction, pending] = useActionState(updateEmailOptions, initialState);
  const [, startSave] = useTransition();
  const [ccOn, setCcOn] = useState(org.smtp_cc_enabled);
  const [bccOn, setBccOn] = useState(org.smtp_bcc_enabled);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => formAction(fd));
      }}
      className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5 flex flex-col gap-4"
    >
      {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}
      <div>
        <div className="text-[14.5px] font-bold text-text-main mb-1">Email options</div>
        <div className="text-[12.5px] text-text-sub">
          Apply to every notification. Per-notification Cc/Bcc of reporting managers is set below, next to each email.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Daily reminder time ({org.timezone ?? "UTC"})</label>
          <input
            type="time"
            name="reminderTime"
            defaultValue={(org.reminder_time ?? "09:00").slice(0, 5)}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className={label}>Standard email signature</label>
        <textarea
          name="emailSignature"
          rows={3}
          defaultValue={org.email_signature ?? ""}
          placeholder={"Best regards,\nThe team at " + org.name}
          className={`${input} resize-y`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-panel-border p-3.5">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-main cursor-pointer mb-2">
            <input type="checkbox" name="smtpCcEnabled" checked={ccOn} onChange={(e) => setCcOn(e.target.checked)} />
            Always Cc these addresses
          </label>
          <input
            name="smtpCc"
            defaultValue={org.smtp_cc ?? ""}
            disabled={!ccOn}
            placeholder="hr@acme.com"
            className={`${input} disabled:opacity-50`}
          />
        </div>
        <div className="rounded-lg border border-panel-border p-3.5">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-main cursor-pointer mb-2">
            <input type="checkbox" name="smtpBccEnabled" checked={bccOn} onChange={(e) => setBccOn(e.target.checked)} />
            Always Bcc these addresses
          </label>
          <input
            name="smtpBcc"
            defaultValue={org.smtp_bcc ?? ""}
            disabled={!bccOn}
            placeholder="audit@acme.com"
            className={`${input} disabled:opacity-50`}
          />
        </div>
      </div>

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? <div className="text-[12.5px] text-success">Saved.</div> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save email options"}
      </button>
    </form>
  );
}
