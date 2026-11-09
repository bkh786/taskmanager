"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createDesignation,
  renameDesignation,
  setDesignationParent,
  type UserFormState,
} from "@/app/(app)/users/actions";
import type { DesignationItem } from "@/lib/org-data";

const select =
  "px-2.5 py-1.5 border border-panel-border rounded-md text-[12.5px] bg-panel-bg text-text-main";

/**
 * Designations with their place in the reporting hierarchy: each one can name
 * the designation its holders report to. That mapping drives the "Reports to"
 * choices when editing a user.
 */
export function DesignationManager({
  items,
  orgId,
}: {
  items: DesignationItem[];
  orgId?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startWork] = useTransition();

  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [state, formAction, adding] = useActionState(
    async (_p: UserFormState, fd: FormData) => {
      const res = await createDesignation(_p, fd);
      if (!res.error) {
        setNewName("");
        setNewParent("");
      }
      return res;
    },
    { error: null } as UserFormState
  );

  const nameOf = (id: string | null) => items.find((i) => i.id === id)?.name ?? null;

  function withOrg(fd: FormData) {
    if (orgId) fd.set("orgId", orgId);
    return fd;
  }

  function saveName(id: string) {
    const fd = withOrg(new FormData());
    fd.set("id", id);
    fd.set("name", draft);
    startWork(async () => {
      const res = await renameDesignation(fd);
      setError(res.error);
      if (!res.error) setEditing(null);
    });
  }

  function saveParent(id: string, parentId: string) {
    const fd = withOrg(new FormData());
    fd.set("id", id);
    fd.set("parentId", parentId);
    startWork(async () => {
      const res = await setDesignationParent(fd);
      setError(res.error);
    });
  }

  return (
    <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14.5px] font-bold text-text-main">Designations &amp; reporting hierarchy</div>
        <div className="text-[12.5px] text-text-sub">{items.length} total</div>
      </div>
      <div className="text-[12.5px] text-text-sub mb-3.5">
        Pick the designation each one reports to. When you set someone&apos;s manager, only people
        holding the mapped designation are listed.
      </div>

      <div className="flex flex-col mb-4">
        {items.length === 0 ? (
          <span className="text-[12.5px] text-text-faint">No designations yet.</span>
        ) : (
          items.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-3 py-2 border-b border-row-hover-border last:border-b-0 flex-wrap"
            >
              {editing === i.id ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(i.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="flex-1 min-w-[160px] max-w-[300px] px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveName(i.id)}
                    className="border-none bg-accent text-white px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-[160px] text-[13.5px] text-text-main">{i.name}</span>
                  <label className="flex items-center gap-2 text-[12px] text-text-sub">
                    Reports to
                    <select
                      value={i.reports_to_designation_id ?? ""}
                      disabled={busy}
                      onChange={(e) => saveParent(i.id, e.target.value)}
                      className={select}
                    >
                      <option value="">— Top level —</option>
                      {items
                        .filter((o) => o.id !== i.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </label>
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

      <form
        action={(fd) => {
          if (orgId) fd.set("orgId", orgId);
          formAction(fd);
        }}
        className="flex gap-2 flex-wrap items-center"
      >
        <input
          name="name"
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New designation name"
          className="flex-1 min-w-[200px] max-w-[300px] px-2.5 py-1.5 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
        <select
          name="parentId"
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
          className={select}
        >
          <option value="">Reports to: top level</option>
          {items.map((o) => (
            <option key={o.id} value={o.id}>
              Reports to: {o.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding}
          className="border border-panel-border bg-panel-bg text-text-body px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          {adding ? "Adding…" : "+ Add"}
        </button>
        {state.error ? <div className="text-[11px] text-danger">{state.error}</div> : null}
      </form>
      {items.length > 0 ? (
        <div className="text-[11.5px] text-text-faint mt-3">
          Example: {items[0].name}
          {nameOf(items[0].reports_to_designation_id)
            ? ` → ${nameOf(items[0].reports_to_designation_id)}`
            : " (top level)"}
        </div>
      ) : null}
    </div>
  );
}
