"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { savePlatformTemplates, type FormState } from "@/app/(app)/platform/actions";
import { PLATFORM_EVENTS, type PlatformEventDef, type PlatformEventId } from "@/lib/platform-email-events";

export type SavedPlatformTemplates = Record<string, { enabled: boolean; subject: string | null; body: string | null }>;
type Draft = { enabled: boolean; subject: string; body: string };

const initial: FormState = { error: null, success: false };
const input = "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main";

export function PlatformTemplatesForm({ templates }: { templates: SavedPlatformTemplates }) {
  const [state, formAction, pending] = useActionState(savePlatformTemplates, initial);
  const [, startSave] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      PLATFORM_EVENTS.map((d) => {
        const s = templates[d.id];
        return [d.id, { enabled: s ? s.enabled : true, subject: s?.subject ?? d.defaultSubject, body: s?.body ?? d.defaultBody }];
      })
    )
  );
  const [open, setOpen] = useState<PlatformEventId | null>(null);
  const bodyRefs = useRef<Partial<Record<string, HTMLTextAreaElement | null>>>({});

  function patch(id: string, change: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...change } }));
  }
  function insertVariable(id: string, key: string) {
    const el = bodyRefs.current[id];
    const token = `{{${key}}}`;
    const cur = drafts[id].body;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    patch(id, { body: cur.slice(0, start) + token + cur.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const groups: PlatformEventDef["group"][] = ["Billing", "Plans", "Offers"];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => formAction(fd));
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <div className="text-[14.5px] font-bold text-text-main mb-1">Platform notification emails</div>
        <div className="text-[12.5px] text-text-sub">
          Billing, payment, plan and offer emails sent to tenants. Edit the wording; placeholders such as{" "}
          <code className="text-[12px]">{"{{org_name}}"}</code> are filled in automatically.
        </div>
      </div>

      {groups.map((group) => (
        <div key={group} className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
          <div className="text-[11.5px] font-bold text-text-sub uppercase tracking-wide mb-3">{group}</div>
          {PLATFORM_EVENTS.filter((e) => e.group === group).map((def) => {
            const d = drafts[def.id];
            const isOpen = open === def.id;
            const customized = d.subject !== def.defaultSubject || d.body !== def.defaultBody;
            return (
              <div key={def.id} className="py-3 border-b border-row-hover-border last:border-b-0">
                <div className="flex items-start gap-3">
                  <input type="checkbox" name={`enabled_${def.id}`} checked={d.enabled} onChange={(e) => patch(def.id, { enabled: e.target.checked })} className="mt-1" aria-label={`Send: ${def.label}`} />
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-text-main">
                      {def.label}
                      {customized ? <span className="ml-2 text-[11px] font-normal text-accent">customized</span> : null}
                    </div>
                    <div className="text-[12px] text-text-sub">{def.description}</div>
                  </div>
                  <button type="button" onClick={() => setOpen(isOpen ? null : def.id)} className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer">
                    {isOpen ? "Close" : "Edit"}
                  </button>
                </div>
                <div className={isOpen ? "mt-3 flex flex-col gap-2.5" : "hidden"}>
                  <input name={`subject_${def.id}`} value={d.subject} onChange={(e) => patch(def.id, { subject: e.target.value })} className={input} aria-label="Subject" />
                  <textarea
                    name={`body_${def.id}`}
                    rows={10}
                    value={d.body}
                    ref={(el) => {
                      bodyRefs.current[def.id] = el;
                    }}
                    onChange={(e) => patch(def.id, { body: e.target.value })}
                    className={input}
                    aria-label="Body"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {def.variables.map((v) => (
                      <button key={v.key} type="button" title={v.description} onClick={() => insertVariable(def.id, v.key)} className="px-2 py-1 rounded-full text-[11.5px] bg-chip-bg text-text-body border border-panel-border cursor-pointer">
                        {`{{${v.key}}}`}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => patch(def.id, { subject: def.defaultSubject, body: def.defaultBody })} className="self-start text-[12px] text-accent font-semibold cursor-pointer bg-transparent border-none">
                    Restore default wording
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.success ? <div className="text-[12.5px] text-success">Templates saved.</div> : null}
      <div>
        <button type="submit" disabled={pending} className="border-none bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60">
          {pending ? "Saving…" : "Save templates"}
        </button>
      </div>
    </form>
  );
}
