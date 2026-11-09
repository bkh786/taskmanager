"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateSmtpSettings,
  sendTestEmailAction,
  type SettingsFormState,
} from "@/app/(app)/org-settings/actions";
import { SECURE_OPTIONS, SMTP_PRESETS, type SmtpSecure } from "@/lib/smtp-presets";
import type { Tables } from "@/types/database.types";

const initialState: SettingsFormState = { error: null, success: false };

/** The organization row as the settings screen sees it: credentials never leave the server except the username; the password is only reported as set / not set. */
export type OrgSettingsOrg = Omit<Tables<"organizations">, "smtp_password"> & {
  has_smtp_password: boolean;
};

const input =
  "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";
const card = "bg-panel-bg border border-panel-border rounded-[10px] p-5.5";

export function SmtpSettingsForm({
  org,
  orgId,
}: {
  org: OrgSettingsOrg;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(updateSmtpSettings, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const [host, setHost] = useState(org.smtp_host ?? "");
  const [port, setPort] = useState(String(org.smtp_port ?? 587));
  const [secure, setSecure] = useState<SmtpSecure>((org.smtp_secure as SmtpSecure) ?? "auto");
  const [username, setUsername] = useState(org.smtp_username ?? "");
  const [presetId, setPresetId] = useState<string>(() => {
    const match = SMTP_PRESETS.find((p) => p.id !== "custom" && p.host === org.smtp_host);
    return match?.id ?? "custom";
  });

  const [, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const preset = SMTP_PRESETS.find((p) => p.id === presetId) ?? SMTP_PRESETS[SMTP_PRESETS.length - 1];

  function applyPreset(id: string) {
    const p = SMTP_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    if (id !== "custom") {
      setHost(p.host);
      setPort(String(p.port));
      setSecure(p.secure);
      if (id === "sendgrid") setUsername("apikey");
    }
  }

  // Submitting through our own handler (instead of <form action>) stops React
  // from resetting the form after the action, which would wipe the controlled
  // fields (host, port, encryption...) back to their first-render values.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(() => formAction(fd));
  }

  // The password field is write-only: clear it once it has been saved.
  useEffect(() => {
    if (state.success) {
      const pw = formRef.current?.elements.namedItem("smtpPassword");
      if (pw instanceof HTMLInputElement) pw.value = "";
    }
  }, [state]);

  function runTest() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setTestResult(null);
    startTest(async () => {
      setTestResult(await sendTestEmailAction(fd));
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}

      <div className={card}>
        <div className="text-[14.5px] font-bold text-text-main mb-1">
          Outbound email (SMTP) configuration
        </div>
        <div className="text-[12.5px] text-text-sub mb-4">
          Every email the app sends (welcome, password reset, task assignment, completion and reminders) goes out from this mail server. Saved values are kept; the password is never shown again.
        </div>

        <div className="text-[11.5px] font-bold text-text-sub uppercase tracking-wide mb-2">
          1-click provider presets
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {SMTP_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold cursor-pointer border ${
                presetId === p.id
                  ? "bg-accent text-white border-accent"
                  : "bg-chip-bg text-text-body border-panel-border"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="text-[12.5px] text-text-body bg-table-head-bg border border-panel-border rounded-md px-3 py-2.5 mb-4">
          <span className="font-semibold">{preset.label} setup note: </span>
          {preset.note}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={label}>SMTP host *</label>
            <input
              name="smtpHost"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.example.com"
              className={input}
            />
          </div>
          <div>
            <label className={label}>SMTP port *</label>
            <input
              type="number"
              name="smtpPort"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Encryption / SSL mode</label>
            <select
              name="smtpSecure"
              value={secure}
              onChange={(e) => setSecure(e.target.value as SmtpSecure)}
              className={input}
            >
              {SECURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={label}>SMTP username / email *</label>
            <input
              name="smtpUsername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className={input}
            />
          </div>
          <div>
            <label className={label}>SMTP password / app password *</label>
            <input
              type="password"
              name="smtpPassword"
              autoComplete="new-password"
              placeholder={org.has_smtp_password ? "••••••••  (saved — leave blank to keep)" : ""}
              className={input}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Sender display name</label>
            <input
              name="smtpFromName"
              defaultValue={org.smtp_from_name ?? ""}
              placeholder={org.name}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Sender from email *</label>
            <input
              type="email"
              name="smtpFromEmail"
              defaultValue={org.smtp_from_email ?? ""}
              placeholder="notifications@acme.com"
              className={input}
            />
          </div>
        </div>
      </div>

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? <div className="text-[12.5px] text-success">Settings saved.</div> : null}
      {testResult ? (
        <div className={`text-[12.5px] ${testResult.ok ? "text-success" : "text-danger"}`}>
          {testResult.message}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save SMTP settings"}
        </button>
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] font-semibold cursor-pointer disabled:opacity-60"
        >
          {testing ? "Sending test…" : "Send test email to me"}
        </button>
        <span className="text-[11.5px] text-text-faint">
          The test uses the values above, even if not saved yet.
        </span>
      </div>
    </form>
  );
}
