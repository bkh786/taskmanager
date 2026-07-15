"use client";

import { useActionState } from "react";
import * as XLSX from "xlsx";
import { bulkCreateTasks } from "@/app/(app)/bulk-upload/actions";
import {
  TEMPLATE_COLUMNS,
  TEMPLATE_EXAMPLE_ROW,
  TEMPLATE_NOTES,
} from "@/lib/task-template";

const initialState = { error: null, created: 0, skipped: [] };

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE_ROW], {
    header: [...TEMPLATE_COLUMNS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  XLSX.writeFile(wb, "task-upload-template.xlsx");
}

export function UploadForm() {
  const [state, formAction, pending] = useActionState(bulkCreateTasks, initialState);

  return (
    <div className="flex flex-col gap-5 max-w-[640px]">
      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="text-[14.5px] font-bold text-text-main mb-2.5">
          1. Download the template
        </div>
        <button
          onClick={downloadTemplate}
          type="button"
          className="border border-panel-border bg-panel-bg text-text-body px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer mb-3"
        >
          ⬇ Download .xlsx template
        </button>
        <ul className="text-[12px] text-text-sub list-disc pl-4 flex flex-col gap-1">
          {TEMPLATE_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="text-[14.5px] font-bold text-text-main mb-2.5">
          2. Upload your filled-in file
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.xls"
            className="text-[13px] text-text-body"
          />
          <button
            type="submit"
            disabled={pending}
            className="self-start border-none bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-md text-[13.5px] font-semibold cursor-pointer disabled:opacity-60"
          >
            {pending ? "Processing…" : "Upload and create tasks"}
          </button>
        </form>

        {state.error ? (
          <div className="text-[12.5px] text-danger mt-3">{state.error}</div>
        ) : null}

        {!state.error && (state.created > 0 || state.skipped.length > 0) ? (
          <div className="mt-4">
            <div className="text-[13px] text-success font-semibold mb-2">
              {state.created} task(s) created.
            </div>
            {state.skipped.length > 0 ? (
              <div>
                <div className="text-[13px] text-danger font-semibold mb-1.5">
                  {state.skipped.length} row(s) skipped:
                </div>
                <ul className="text-[12px] text-text-sub flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                  {state.skipped.map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
