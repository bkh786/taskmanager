"use client";

import { useActionState, useState } from "react";
import * as XLSX from "xlsx";
import { bulkCreateUsers } from "@/app/(app)/bulk-upload-users/actions";
import {
  USER_TEMPLATE_COLUMNS,
  buildUserTemplateRow,
  USER_TEMPLATE_NOTES,
} from "@/lib/user-template";

const initialState = { error: null, created: 0, skipped: [] };

type Org = { id: string; slug: string; name: string };

function downloadTemplate(orgCode: string) {
  const ws = XLSX.utils.json_to_sheet([buildUserTemplateRow(orgCode)], {
    header: [...USER_TEMPLATE_COLUMNS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  XLSX.writeFile(wb, `user-upload-template-${orgCode}.xlsx`);
}

export function BulkUsersUploadForm({ orgs }: { orgs: Org[] }) {
  const [state, formAction, pending] = useActionState(bulkCreateUsers, initialState);
  const [selectedOrgId, setSelectedOrgId] = useState(orgs[0]?.id ?? "");
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0];

  if (orgs.length === 0) {
    return (
      <div className="text-[13.5px] text-danger">
        No organization is available for bulk upload.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[640px]">
      {orgs.length > 1 ? (
        <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
          <div className="text-[14.5px] font-bold text-text-main mb-2.5">Tenant</div>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full max-w-[340px] px-2.5 py-2 border border-panel-border rounded-md text-[13.5px] bg-panel-bg text-text-main"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.slug})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="text-[14.5px] font-bold text-text-main mb-2.5">
          1. Download the template
        </div>
        <div className="text-[12.5px] text-text-sub mb-3">
          Organization code: <span className="font-semibold text-text-main">{selectedOrg?.slug}</span>
        </div>
        <button
          onClick={() => selectedOrg && downloadTemplate(selectedOrg.slug)}
          type="button"
          className="border border-panel-border bg-panel-bg text-text-body px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer mb-3"
        >
          ⬇ Download .xlsx template
        </button>
        <ul className="text-[12px] text-text-sub list-disc pl-4 flex flex-col gap-1">
          {USER_TEMPLATE_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-[10px] p-5.5">
        <div className="text-[14.5px] font-bold text-text-main mb-2.5">
          2. Upload your filled-in file
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="orgId" value={selectedOrgId} />
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
            {pending ? "Processing…" : "Upload and create users"}
          </button>
        </form>

        {state.error ? (
          <div className="text-[12.5px] text-danger mt-3">{state.error}</div>
        ) : null}

        {!state.error && (state.created > 0 || state.skipped.length > 0) ? (
          <div className="mt-4">
            <div className="text-[13px] text-success font-semibold mb-2">
              {state.created} user(s) created.
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
