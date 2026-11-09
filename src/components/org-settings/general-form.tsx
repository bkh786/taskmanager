"use client";

import { useActionState, useTransition } from "react";
import { updateGeneralSettings, type SettingsFormState } from "@/app/(app)/org-settings/actions";

const initialState: SettingsFormState = { error: null, success: false };

const input =
  "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";

function timezones(current: string): string[] {
  let list: string[] = [];
  try {
    list = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    list = ["Asia/Kolkata", "UTC"];
  }
  if (!list.includes("Asia/Kolkata")) list = ["Asia/Kolkata", ...list];
  if (current && !list.includes(current)) list = [current, ...list];
  return list;
}

export function GeneralForm({
  name,
  timezone,
  orgId,
}: {
  name: string;
  timezone: string;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(updateGeneralSettings, initialState);
  const [, startSave] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => formAction(fd));
      }}
      className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5"
    >
      {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}
      <div className="text-[14.5px] font-bold text-text-main mb-4">Company profile</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[640px]">
        <div>
          <label className={label}>Company name</label>
          <input name="name" required defaultValue={name} className={input} />
        </div>
        <div>
          <label className={label}>Timezone</label>
          <select name="timezone" defaultValue={timezone} className={input}>
            {timezones(timezone).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state.error ? <div className="text-[12.5px] text-danger mt-3">{state.error}</div> : null}
      {state.success ? <div className="text-[12.5px] text-success mt-3">Saved.</div> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
