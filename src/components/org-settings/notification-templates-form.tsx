"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveEmailTemplates, type TemplatesFormState } from "@/app/(app)/org-settings/actions";
import { EMAIL_EVENTS, type EmailEventDef, type EmailEventId } from "@/lib/email-events";

const initialState: TemplatesFormState = { error: null, success: false };

export type SavedTemplates = Record<
  string,
  {
    enabled: boolean;
    subject: string | null;
    body: string | null;
    cc_l1?: boolean;
    cc_l2?: boolean;
    bcc_l1?: boolean;
    bcc_l2?: boolean;
  }
>;

type Draft = {
  enabled: boolean;
  subject: string;
  body: string;
  cc_l1: boolean;
  cc_l2: boolean;
  bcc_l1: boolean;
  bcc_l2: boolean;
};

const input =
  "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main";

function initialDrafts(saved: SavedTemplates): Record<EmailEventId, Draft> {
  const out = {} as Record<EmailEventId, Draft>;
  for (const def of EMAIL_EVENTS) {
    const s = saved[def.id];
    out[def.id] = {
      enabled: s ? s.enabled : true,
      subject: s?.subject ?? def.defaultSubject,
      body: s?.body ?? def.defaultBody,
      cc_l1: s?.cc_l1 ?? false,
      cc_l2: s?.cc_l2 ?? false,
      bcc_l1: s?.bcc_l1 ?? false,
      bcc_l2: s?.bcc_l2 ?? false,
    };
  }
  return out;
}

export function NotificationTemplatesForm({
  templates,
  orgId,
}: {
  templates: SavedTemplates;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(saveEmailTemplates, initialState);
  const [, startSave] = useTransition();
  const [drafts, setDrafts] = useState(() => initialDrafts(templates));
  const [open, setOpen] = useState<EmailEventId | null>(null);
  const subjectRefs = useRef<Partial<Record<EmailEventId, HTMLInputElement | null>>>({});
  const bodyRefs = useRef<Partial<Record<EmailEventId, HTMLTextAreaElement | null>>>({});
  const lastFocus = useRef<Partial<Record<EmailEventId, "subject" | "body">>>({});

  function patch(id: EmailEventId, change: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...change } }));
  }

  function insertVariable(id: EmailEventId, key: string) {
    const field = lastFocus.current[id] ?? "body";
    const el = field === "subject" ? subjectRefs.current[id] : bodyRefs.current[id];
    const token = `{{${key}}}`;
    const current = drafts[id][field];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    patch(id, { [field]: current.slice(0, start) + token + current.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const groups: EmailEventDef["group"][] = ["Accounts", "Tasks", "Reminders"];

  // Own submit handler: <form action> would reset the controlled fields after saving.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}

      <div>
        <div className="text-[14.5px] font-bold text-text-main mb-1">Notification emails</div>
        <div className="text-[12.5px] text-text-sub">
          Choose which emails are sent and edit their wording. Placeholders such as{" "}
          <code className="text-[12px]">{"{{task_name}}"}</code> are filled in automatically.
          For each email, tick which reporting managers are copied. L1 is the manager of the person
          the email is about, L2 is that manager&apos;s manager. For task emails that person is the
          assignee (the one who completes or asks to reschedule); for account and reminder emails it
          is the recipient. Task creators can also add
          extra Cc recipients and switch off the completion email on each task.
        </div>
      </div>

      {groups.map((group) => (
        <div key={group} className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
          <div className="text-[11.5px] font-bold text-text-sub uppercase tracking-wide mb-3">
            {group}
          </div>
          <div className="flex flex-col">
            {EMAIL_EVENTS.filter((e) => e.group === group).map((def) => {
              const d = drafts[def.id];
              const isOpen = open === def.id;
              const customized = d.subject !== def.defaultSubject || d.body !== def.defaultBody;
              return (
                <div
                  key={def.id}
                  className="py-3 border-b border-row-hover-border last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name={`enabled_${def.id}`}
                      checked={d.enabled}
                      onChange={(e) => patch(def.id, { enabled: e.target.checked })}
                      className="mt-1"
                      aria-label={`Send: ${def.label}`}
                    />
                    <div className="flex-1">
                      <div className="text-[13.5px] font-semibold text-text-main">
                        {def.label}
                        {customized ? (
                          <span className="ml-2 text-[11px] font-normal text-accent">
                            customized
                          </span>
                        ) : null}
                        {!d.enabled ? (
                          <span className="ml-2 text-[11px] font-normal text-text-faint">
                            off
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[12.5px] text-text-sub">{def.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : def.id)}
                      className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      {isOpen ? "Close" : "Edit wording"}
                    </button>
                  </div>

                  <div className="mt-2.5 pl-7 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[12.5px] text-text-body">
                    {(
                      [
                        ["Cc", "cc_l1", "cc_l2"],
                        ["Bcc", "bcc_l1", "bcc_l2"],
                      ] as const
                    ).map(([title, l1, l2]) => (
                      <div key={title} className="flex items-center gap-3">
                        <span className="font-semibold text-text-sub">{title}:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`${l1}_${def.id}`}
                            checked={d[l1]}
                            onChange={(e) => patch(def.id, { [l1]: e.target.checked })}
                          />
                          L1 reporting manager
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`${l2}_${def.id}`}
                            checked={d[l2]}
                            onChange={(e) => patch(def.id, { [l2]: e.target.checked })}
                          />
                          L2 reporting manager
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Always rendered so the values are submitted even while collapsed. */}
                  <div className={isOpen ? "mt-3 pl-7 flex flex-col gap-2.5" : "hidden"}>
                    <div>
                      <label className="text-xs font-semibold text-text-sub block mb-1.5">
                        Subject
                      </label>
                      <input
                        name={`subject_${def.id}`}
                        ref={(el) => {
                          subjectRefs.current[def.id] = el;
                        }}
                        value={d.subject}
                        onChange={(e) => patch(def.id, { subject: e.target.value })}
                        onFocus={() => (lastFocus.current[def.id] = "subject")}
                        className={input}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-text-sub block mb-1.5">
                        Message
                      </label>
                      <textarea
                        name={`body_${def.id}`}
                        ref={(el) => {
                          bodyRefs.current[def.id] = el;
                        }}
                        rows={9}
                        value={d.body}
                        onChange={(e) => patch(def.id, { body: e.target.value })}
                        onFocus={() => (lastFocus.current[def.id] = "body")}
                        className={`${input} resize-y font-mono text-[12.5px]`}
                      />
                    </div>
                    <div>
                      <div className="text-[11.5px] font-semibold text-text-sub mb-1.5">
                        Click a placeholder to insert it where your cursor is
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {def.variables.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            title={v.description}
                            onClick={() => insertVariable(def.id, v.key)}
                            className="px-2 py-1 rounded-md bg-chip-bg text-text-body text-[11.5px] font-mono border border-panel-border cursor-pointer"
                          >
                            {`{{${v.key}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          patch(def.id, { subject: def.defaultSubject, body: def.defaultBody })
                        }
                        className="text-[12px] text-accent font-semibold cursor-pointer bg-transparent border-none p-0"
                      >
                        Reset to default wording
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? (
        <div className="text-[12.5px] text-success">Notification settings saved.</div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save notification settings"}
      </button>
    </form>
  );
}
