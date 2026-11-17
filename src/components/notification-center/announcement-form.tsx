"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { createAnnouncement, type CenterState } from "@/app/(app)/notification-center/actions";
import { AUDIENCE_ROLES } from "@/lib/notification-shared";

const initial: CenterState = { error: null };
const input = "w-full px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main";
const label = "text-xs font-semibold text-text-sub block mb-1.5";

function Checklist({ name, items, selected, onChange }: { name: string; items: { id: string; label: string }[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => !q.trim() || i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {items.length > 8 ? (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={`${input} mb-1.5`} />
      ) : null}
      <div className="border border-panel-border rounded-md max-h-[170px] overflow-y-auto bg-panel-bg">
        {shown.map((i) => (
          <label key={i.id} className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-text-main cursor-pointer hover:bg-table-head-bg">
            <input
              type="checkbox"
              checked={selected.has(i.id)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(i.id)) next.delete(i.id);
                else next.add(i.id);
                onChange(next);
              }}
            />
            {i.label}
          </label>
        ))}
        {shown.length === 0 ? <div className="px-2.5 py-2 text-[12px] text-text-faint">Nothing matches.</div> : null}
      </div>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="text-[11px] text-text-faint mt-1">{selected.size} selected</div>
    </div>
  );
}

export function AnnouncementForm({
  mode,
  projects,
  people,
  orgs,
}: {
  mode: "org" | "platform";
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
  orgs: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createAnnouncement, initial);
  const [formKey, setFormKey] = useState(0);
  return (
    <FormInner
      key={formKey}
      mode={mode}
      projects={projects}
      people={people}
      orgs={orgs}
      state={state}
      pending={pending}
      action={(fd) => {
        formAction(fd);
      }}
      onDone={() => setFormKey((k) => k + 1)}
    />
  );
}

function FormInner({
  mode,
  projects,
  people,
  orgs,
  state,
  pending,
  action,
  onDone,
}: {
  mode: "org" | "platform";
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
  orgs: { id: string; name: string }[];
  state: CenterState;
  pending: boolean;
  action: (fd: FormData) => void;
  onDone: () => void;
}) {
  const [level, setLevel] = useState<"info" | "critical">("info");
  const [scope, setScope] = useState("all");
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set());
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [orgIds, setOrgIds] = useState<Set<string>>(new Set());
  const [allOrgs, setAllOrgs] = useState(true);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [, startSubmit] = useTransition();
  const peopleItems = useMemo(() => people.map((p) => ({ id: p.id, label: p.name })), [people]);

  return (
    <form
      // Submitted by hand so a validation error doesn't clear what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSubmit(() => action(fd));
      }}
      className="bg-panel-bg border border-panel-border rounded-xl px-5 py-4 flex flex-col gap-4"
    >
      <div>
        <div className="text-[15px] font-bold text-text-main">{mode === "platform" ? "New platform announcement" : "New announcement"}</div>
        <div className="text-[12.5px] text-text-sub mt-0.5">
          {mode === "platform"
            ? "Share feature updates or notices with organizations on the platform."
            : "Send a message to your people. It appears in their notification bell and can be pushed to their devices."}
        </div>
      </div>

      <div>
        <label className={label}>Importance</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(
            [
              ["info", "General update", "Quiet: shows in the bell under Updates."],
              ["critical", "Critical alert", "Pinned as a red banner until each person acknowledges it."],
            ] as const
          ).map(([v, t, d]) => (
            <label
              key={v}
              className="flex gap-2.5 items-start rounded-lg p-3 cursor-pointer"
              style={{
                border: `1.5px solid ${level === v ? (v === "critical" ? "var(--danger)" : "var(--accent)") : "var(--panel-border)"}`,
                background: level === v ? (v === "critical" ? "color-mix(in srgb, var(--danger) 8%, transparent)" : "var(--accent-soft)") : "transparent",
              }}
            >
              <input type="radio" name="level" value={v} checked={level === v} onChange={() => setLevel(v)} className="mt-1" />
              <span>
                <span className="block text-[13px] font-bold text-text-main">{t}</span>
                <span className="block text-[11.5px] text-text-sub">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3.5">
          <div>
            <label className={label}>Title</label>
            <input name="title" required maxLength={200} placeholder={mode === "platform" ? "New: Voice and video calls" : "Office closed on Friday"} className={input} />
          </div>
          <div>
            <label className={label}>Message (optional)</label>
            <textarea name="body" rows={4} maxLength={2000} className={`${input} resize-y`} placeholder="Add the details people need." />
          </div>
          <div>
            <label className={label}>Link (optional)</label>
            <input name="link" placeholder="/team-chat or https://…" className={input} />
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          {mode === "org" ? (
            <div>
              <label className={label}>Who gets it</label>
              <select name="scope" value={scope} onChange={(e) => setScope(e.target.value)} className={input}>
                <option value="all">Everyone in the organization</option>
                <option value="roles">Specific roles</option>
                <option value="projects">People in specific projects</option>
                <option value="users">Specific people</option>
              </select>
              <div className="mt-2">
                {scope === "roles" ? (
                  <Checklist name="roles" items={AUDIENCE_ROLES.map((r) => ({ id: r.value, label: r.label }))} selected={roles} onChange={setRoles} />
                ) : null}
                {scope === "projects" ? <Checklist name="projectIds" items={projects.map((p) => ({ id: p.id, label: p.name }))} selected={projectIds} onChange={setProjectIds} /> : null}
                {scope === "users" ? <Checklist name="userIds" items={peopleItems} selected={userIds} onChange={setUserIds} /> : null}
              </div>
            </div>
          ) : (
            <div>
              <label className={label}>Who gets it</label>
              <label className="flex items-center gap-2 text-[13px] text-text-main cursor-pointer mb-2">
                <input type="checkbox" name="allOrgs" checked={allOrgs} onChange={(e) => setAllOrgs(e.target.checked)} />
                All active organizations
              </label>
              {!allOrgs ? <Checklist name="orgIds" items={orgs.map((o) => ({ id: o.id, label: o.name }))} selected={orgIds} onChange={setOrgIds} /> : null}
              <label className="flex items-center gap-2 text-[13px] text-text-main cursor-pointer mt-2">
                <input type="checkbox" name="adminsOnly" />
                Only organization admins
              </label>
            </div>
          )}

          <div>
            <label className={label}>Delivery</label>
            <label className="flex items-center gap-2 text-[13px] text-text-main cursor-pointer">
              <input type="checkbox" name="sendPush" defaultChecked />
              Also send a push notification to devices that turned it on
            </label>
          </div>

          <div>
            <label className={label}>When</label>
            <div className="flex gap-4 text-[13px] text-text-main">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="when" value="now" checked={when === "now"} onChange={() => setWhen("now")} /> Send now
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="when" value="later" checked={when === "later"} onChange={() => setWhen("later")} /> Schedule
              </label>
            </div>
            {when === "later" ? (
              <div className="mt-2">
                <input type="datetime-local" name="publishAt" required className={input} />
                <div className="text-[11px] text-text-faint mt-1">Time is India Standard Time (IST).</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {state.error ? <div className="text-[12.5px] text-danger">{state.error}</div> : null}
      {state.ok && !pending ? (
        <div className="text-[12.5px] text-success">
          {when === "later" ? "Scheduled." : "Sent."}{" "}
          <button type="button" onClick={onDone} className="border-none bg-transparent text-accent font-semibold cursor-pointer p-0">
            Write another
          </button>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="border-none text-white px-5 py-2.5 rounded-md text-[13.5px] font-bold cursor-pointer disabled:opacity-60"
          style={{ background: level === "critical" ? "var(--danger)" : "var(--accent)" }}
        >
          {pending ? "Sending…" : when === "later" ? "Schedule" : level === "critical" ? "Send critical alert" : "Send"}
        </button>
      </div>
    </form>
  );
}
