"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createProject, createDesignation, type UserFormState } from "@/app/(app)/users/actions";

const initialState: UserFormState = { error: null };

export function AddForm({
  action,
  placeholder,
  orgId,
}: {
  action: (prev: UserFormState, fd: FormData) => Promise<UserFormState>;
  placeholder: string;
  orgId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [value, setValue] = useState("");
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (submittedOnce.current && !pending && state.error === null) {
      setValue("");
      submittedOnce.current = false;
    }
  }, [pending, state]);

  return (
    <form
      action={(fd) => {
        submittedOnce.current = true;
        formAction(fd);
      }}
      className="flex gap-2"
    >
      {orgId ? <input type="hidden" name="orgId" value={orgId} /> : null}
      <input
        name="name"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
      />
      <button
        type="submit"
        disabled={pending}
        className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
      >
        {pending ? "Adding…" : "+ Add"}
      </button>
      {state.error ? <div className="text-[11px] text-danger self-center">{state.error}</div> : null}
    </form>
  );
}

export function ProjectsDesignationsPanel({
  projects,
  designations,
  canCreate = true,
  orgId,
}: {
  projects: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  canCreate?: boolean;
  orgId?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-4">
        <div className="text-xs font-bold text-text-sub uppercase mb-2.5">Projects</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {projects.length === 0 ? (
            <span className="text-[12px] text-text-faint">None yet.</span>
          ) : (
            projects.map((p) => (
              <span
                key={p.id}
                className="text-[12px] font-medium px-2 py-1 rounded-md bg-chip-bg text-text-body"
              >
                {p.name}
              </span>
            ))
          )}
        </div>
        {canCreate ? (
          <AddForm action={createProject} placeholder="New project name" orgId={orgId} />
        ) : null}
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-4">
        <div className="text-xs font-bold text-text-sub uppercase mb-2.5">Designations</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {designations.length === 0 ? (
            <span className="text-[12px] text-text-faint">None yet.</span>
          ) : (
            designations.map((d) => (
              <span
                key={d.id}
                className="text-[12px] font-medium px-2 py-1 rounded-md bg-chip-bg text-text-body"
              >
                {d.name}
              </span>
            ))
          )}
        </div>
        {canCreate ? (
          <AddForm action={createDesignation} placeholder="New designation name" orgId={orgId} />
        ) : null}
      </div>
    </div>
  );
}

/** A titled list of names with inline rename and an add form -- used on the Organization Settings tabs. */
export function NameListManager({
  title,
  items,
  createAction,
  renameAction,
  placeholder,
  emptyText,
  orgId,
}: {
  title: string;
  items: { id: string; name: string }[];
  createAction: (prev: UserFormState, fd: FormData) => Promise<UserFormState>;
  renameAction: (fd: FormData) => Promise<UserFormState>;
  placeholder: string;
  emptyText: string;
  orgId?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function save(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", draft);
    if (orgId) fd.set("orgId", orgId);
    startSave(async () => {
      const res = await renameAction(fd);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setEditing(null);
      }
    });
  }

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[14.5px] font-bold text-text-main">{title}</div>
        <div className="text-[12.5px] text-text-sub">{items.length} total</div>
      </div>
      <div className="flex flex-col mb-4">
        {items.length === 0 ? (
          <span className="text-[12.5px] text-text-faint">{emptyText}</span>
        ) : (
          items.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-3 py-2 border-b border-row-hover-border last:border-b-0"
            >
              {editing === i.id ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save(i.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="flex-1 max-w-[360px] px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save(i.id)}
                    className="border-none bg-accent text-white px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setError(null);
                    }}
                    className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13.5px] text-text-main">{i.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(i.id);
                      setDraft(i.name);
                      setError(null);
                    }}
                    className="border border-panel-border bg-panel-bg text-text-body px-2.5 py-1 rounded-md text-xs cursor-pointer"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          ))
        )}
        {error ? <div className="text-[12px] text-danger mt-2">{error}</div> : null}
      </div>
      <div className="max-w-[460px]">
        <AddForm action={createAction} placeholder={placeholder} orgId={orgId} />
      </div>
    </div>
  );
}
