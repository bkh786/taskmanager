"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { savePlatformSmtp, sendPlatformTestAction, type FormState } from "@/app/(app)/platform/actions";
import { SECURE_OPTIONS, SMTP_PRESETS, type SmtpSecure } from "@/lib/smtp-presets";
import type { Tables } from "@/types/database.types";

export type PlatformSmtp = Omit<Tables<"platform_email_settings">, "smtp_password"> & { has_smtp_password: boolean };

const initial: FormState = { error: null, success: false };
const input = "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";
const card = "bg-panel-bg border border-panel-border rounded-[10px] p-5.5";

export function PlatformSmtpForm({ settings }: { settings: PlatformSmtp }) {
  const [state, formAction, pending] = useActionState(savePlatformSmtp, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [host, setHost] = useState(settings.smtp_host ?? "");
  const [port, setPort] = useState(String(settings.smtp_port ?? 587));
  const [secure, setSecure] = useState<SmtpSecure>((settings.smtp_secure as SmtpSecure) ?? "auto");
  const [username, setUsername] = useState(settings.smtp_username ?? "");
  const [presetId, setPresetId] = useState(
    () => SMTP_PRESETS.find((p) => p.id !== "custom" && p.host === settings.smtp_host)?.id ?? "custom"
  );
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

  useEffect(() => {
    if (state.success) {
      const pw = formRef.current?.elements.namedItem("smtpPassword");
      if (pw instanceof HTMLInputElement) pw.value = "";
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => formAction(fd));
      }}
      className="flex flex-col gap-5"
    >
      <div className={card}>
        <div className="text-[14.5px] font-bold text-text-main mb-1">Platform outbound email (SMTP)</div>
        <div className="text-[12.5px] text-text-sub mb-4">
          Used for emails from the platform to tenants: invoices, billing reminders, payment receipts, plan changes and
          offers. Tenants&apos; own task notifications use each tenant&apos;s own SMTP. The password is never shown again.
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {SMTP_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold cursor-pointer border ${
                presetId === p.id ? "bg-accent text-white border-accent" : "bg-chip-bg text-text-body border-panel-border"
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className={label}>SMTP host *</label>
            <input name="smtpHost" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" className={input} />
          </div>
          <div>
            <label className={label}>SMTP port *</label>
            <input type="number" name="smtpPort" value={port} onChange={(e) => setPort(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Encryption / SSL mode</label>
            <select name="smtpSecure" value={secure} onChange={(e) => setSecure(e.target.value as SmtpSecure)} className={input}>
              {SECURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={label}>SMTP username / email *</label>
            <input name="smtpUsername" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className={input} />
          </div>
          <div>
            <label className={label}>SMTP password / app password *</label>
            <input
              type="password"
              name="smtpPassword"
              autoComplete="new-password"
              placeholder={settings.has_smtp_password ? "••••••••  (saved — leave blank to keep)" : ""}
              className={input}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={label}>Sender display name</label>
            <input name="smtpFromName" defaultValue={settings.smtp_from_name ?? ""} placeholder="Digi Presence Billing" className={input} />
          </div>
          <div>
            <label className={label}>Sender from email *</label>
            <input type="email" name="smtpFromEmail" defaultValue={settings.smtp_from_email ?? ""} placeholder="billing@digipresence.in" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={label}>Reply-to address</label>
            <input type="email" name="replyTo" defaultValue={settings.reply_to ?? ""} className={input} />
          </div>
          <div>
            <label className={label}>Always Cc on billing emails</label>
            <input name="billingCc" defaultValue={settings.billing_cc ?? ""} placeholder="accounts@digipresence.in" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Signature</label>
          <textarea name="signature" rows={3} defaultValue={settings.email_signature ?? ""} className={input} />
        </div>
      </div>

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? <div className="text-[12.5px] text-success">Settings saved.</div> : null}
      {testResult ? <div className={`text-[12.5px] ${testResult.ok ? "text-success" : "text-danger"}`}>{testResult.message}</div> : null}

      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={pending} className="border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60">
          {pending ? "Saving…" : "Save SMTP settings"}
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() => {
            if (!formRef.current) return;
            const fd = new FormData(formRef.current);
            setTestResult(null);
            startTest(async () => setTestResult(await sendPlatformTestAction(fd)));
          }}
          className="border border-panel-border bg-panel-bg text-text-body px-4 py-2.5 rounded-md text-[13.5px] font-semibold cursor-pointer disabled:opacity-60"
        >
          {testing ? "Sending test…" : "Send test email to me"}
        </button>
      </div>
    </form>
  );
}
