"use client";

import { useActionState, useState, useTransition } from "react";
import { addRule, deleteRule, saveRule, type CenterState } from "@/app/(app)/notification-center/actions";
import { RULE_KINDS, type RuleKind } from "@/lib/notification-shared";

export type RuleRow = {
  id: string;
  kind: RuleKind;
  name: string;
  enabled: boolean;
  level: "info" | "critical";
  after_days: number;
  to_assignee: boolean;
  to_creator: boolean;
  to_l1: boolean;
  to_l2: boolean;
  to_admins: boolean;
  send_push: boolean;
};

const initial: CenterState = { error: null };
const input = "px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main";

function summary(r: RuleRow): string {
  const who = [
    r.to_assignee && "the assignee",
    r.to_creator && (r.kind === "task_completed" ? "the person who created the task" : "the task's creator"),
    r.to_l1 && "their manager (L1)",
    r.to_l2 && "the manager's manager (L2)",
    r.to_admins && "the org admins",
  ].filter(Boolean) as string[];
  const list = who.length > 1 ? `${who.slice(0, -1).join(", ")} and ${who[who.length - 1]}` : (who[0] ?? "nobody");
  const when =
    r.kind === "task_overdue"
      ? `${r.after_days === 0 ? "On the due date" : `${r.after_days} day${r.after_days === 1 ? "" : "s"} after the due date`}, if not done`
      : r.kind === "task_completed"
        ? "As soon as a task is completed"
        : "As soon as a task is assigned";
  return `${when}: ${r.level === "critical" ? "critical alert" : "general update"} to ${list}${r.send_push ? " (with push)" : ""}.`;
}

function RuleCard({ rule, removable }: { rule: RuleRow; removable: boolean }) {
  const [state, formAction, pending] = useActionState(saveRule, initial);
  const [del, startDel] = useTransition();
  const [, startSave] = useTransition();
  const [draft, setDraft] = useState(rule);
  const critical = draft.level === "critical";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => formAction(fd));
      }}
      className="border border-panel-border rounded-lg p-4 flex flex-col gap-3"
      style={{ borderLeft: `3px solid ${critical ? "var(--danger)" : "var(--accent)"}`, opacity: draft.enabled ? 1 : 0.65 }}
    >
      <input type="hidden" name="id" value={rule.id} />
      <input type="hidden" name="kind" value={rule.kind} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          name="name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Step name"
          className={`${input} font-semibold flex-1 min-w-[200px]`}
        />
        <label className="flex items-center gap-2 text-[13px] text-text-main cursor-pointer">
          <input type="checkbox" name="enabled" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-5 gap-y-3 items-start">
        {rule.kind === "task_overdue" ? (
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1">Fires after</label>
            <div className="flex items-center gap-1.5 text-[13px] text-text-body">
              <input
                type="number"
                name="afterDays"
                min={0}
                max={365}
                value={draft.after_days}
                onChange={(e) => setDraft({ ...draft, after_days: Math.max(0, Number(e.target.value) | 0) })}
                className={`${input} w-[70px]`}
              />
              day(s) overdue
            </div>
          </div>
        ) : (
          <div />
        )}
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1">Importance</label>
            <select name="level" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as "info" | "critical" })} className={input}>
              <option value="info">General update</option>
              <option value="critical">Critical alert</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-text-main cursor-pointer pb-1.5">
            <input type="checkbox" name="sendPush" checked={draft.send_push} onChange={(e) => setDraft({ ...draft, send_push: e.target.checked })} />
            Send push
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-text-sub block mb-1.5">Notify</label>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-text-main">
          {(
            [
              ["toAssignee", "to_assignee", "The assignee"],
              ["toCreator", "to_creator", "Task creator"],
              ["toL1", "to_l1", "Manager (L1)"],
              ["toL2", "to_l2", "Manager's manager (L2)"],
              ["toAdmins", "to_admins", "Org admins"],
            ] as const
          ).map(([field, key, text]) => (
            <label key={field} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" name={field} checked={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} />
              {text}
            </label>
          ))}
        </div>
      </div>

      <div className="text-[12px] text-text-sub bg-table-head-bg rounded-md px-3 py-2">{summary(draft)}</div>

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-success">{state.ok && !pending ? "Saved." : ""}</div>
        <div className="flex gap-2">
          {removable ? (
            <button
              type="button"
              disabled={del}
              onClick={() => {
                if (confirm("Delete this step?")) startDel(async () => void (await deleteRule(rule.id)));
              }}
              className="border border-panel-border bg-panel-bg text-danger px-3 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer disabled:opacity-60"
            >
              Delete
            </button>
          ) : null}
          <button type="submit" disabled={pending} className="border-none bg-accent text-white px-4 py-1.5 rounded-md text-[12.5px] font-bold cursor-pointer disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function RulesEditor({ rules }: { rules: RuleRow[] }) {
  const [adding, start] = useTransition();
  return (
    <div className="flex flex-col gap-5">
      {RULE_KINDS.map((k) => {
        const list = rules.filter((r) => r.kind === k.kind);
        return (
          <section key={k.kind} className="bg-panel-bg border border-panel-border rounded-xl px-5 py-4 flex flex-col gap-3.5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[15px] font-bold text-text-main">{k.title}</div>
                <div className="text-[12.5px] text-text-sub mt-0.5 max-w-[680px]">{k.help}</div>
              </div>
              {k.multi || list.length === 0 ? (
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => start(async () => void (await addRule(k.kind)))}
                  className="border border-panel-border bg-panel-bg text-text-body px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {k.multi ? "+ Add step" : "+ Add rule"}
                </button>
              ) : null}
            </div>
            {list.length === 0 ? (
              <div className="text-[12.5px] text-text-faint">No rule: nobody is notified for this.</div>
            ) : (
              list.map((r) => <RuleCard key={r.id} rule={r} removable={k.multi || true} />)
            )}
          </section>
        );
      })}
    </div>
  );
}
