"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createProject, createDesignation, type UserFormState } from "@/app/(app)/users/actions";

const initialState: UserFormState = { error: null };

function AddForm({
  action,
  placeholder,
}: {
  action: (prev: UserFormState, fd: FormData) => Promise<UserFormState>;
  placeholder: string;
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
}: {
  projects: { id: string; name: string }[];
  designations: { id: string; name: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-5">
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
        <AddForm action={createProject} placeholder="New project name" />
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
        <AddForm action={createDesignation} placeholder="New designation name" />
      </div>
    </div>
  );
}
