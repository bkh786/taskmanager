"use client";

import { useActionState } from "react";
import { updateOrgSettings, type SettingsFormState } from "@/app/(app)/org-settings/actions";
import type { Tables } from "@/types/database.types";

const initialState: SettingsFormState = { error: null, success: false };

export function SettingsForm({
  org,
  orgId,
}: {
  org: Tables<"organizations">;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(updateOrgSettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}
      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="text-[14.5px] font-bold text-text-main mb-4">
          Company profile
        </div>
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          Company name
        </label>
        <input
          name="name"
          required
          defaultValue={org.name}
          className="w-full max-w-[340px] px-2.5 py-2.5 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
        />
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="text-[14.5px] font-bold text-text-main mb-1">
          Email (SMTP)
        </div>
        <div className="text-[12.5px] text-text-sub mb-4">
          Used to send task assignment, completion, and reminder emails to your team.
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              SMTP host
            </label>
            <input
              name="smtpHost"
              defaultValue={org.smtp_host ?? ""}
              placeholder="smtp.example.com"
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              SMTP port
            </label>
            <input
              type="number"
              name="smtpPort"
              defaultValue={org.smtp_port ?? 587}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              SMTP username
            </label>
            <input
              name="smtpUsername"
              defaultValue={org.smtp_username ?? ""}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              SMTP password
            </label>
            <input
              type="password"
              name="smtpPassword"
              placeholder={org.smtp_password ? "••••••••  (unchanged)" : ""}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              From email
            </label>
            <input
              type="email"
              name="smtpFromEmail"
              defaultValue={org.smtp_from_email ?? ""}
              placeholder="notifications@acme.com"
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1.5">
              Daily reminder time
            </label>
            <input
              type="time"
              name="reminderTime"
              defaultValue={(org.reminder_time ?? "09:00").slice(0, 5)}
              className="w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
            />
          </div>
        </div>
      </div>

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? (
        <div className="text-[12.5px] text-success">Settings saved.</div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
