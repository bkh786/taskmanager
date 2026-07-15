"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAssignableEmployees } from "@/lib/org-data";
import type { Enums } from "@/types/database.types";

export type BulkUploadState = {
  error: string | null;
  created: number;
  skipped: { row: number; reason: string }[];
};

const RECURRENCE_KINDS: Enums<"recurrence_kind">[] = [
  "one_time",
  "daily",
  "weekly",
  "monthly",
];

type Row = {
  task_name?: unknown;
  description?: unknown;
  assignee_emails?: unknown;
  recurrence_kind?: unknown;
  recurrence_interval?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  reminder_enabled?: unknown;
};

function toDateString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  return str;
}

export async function bulkCreateTasks(
  _prev: BulkUploadState,
  formData: FormData
): Promise<BulkUploadState> {
  const initial: BulkUploadState = { error: null, created: 0, skipped: [] };
  const appUser = await requireRole(["master_admin", "reporting_manager"]);
  if (!appUser.org_id) return { ...initial, error: "No organization on this account." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...initial, error: "Choose an .xlsx file to upload." };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });

  if (rows.length === 0) {
    return { ...initial, error: "The file has no data rows." };
  }

  const employees = await getAssignableEmployees(appUser);
  const emailToId = new Map(employees.map((e) => [e.email.toLowerCase(), e.id]));

  const supabase = await createClient();
  const skipped: BulkUploadState["skipped"] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // account for header row, 1-indexed
    const row = rows[i];

    const taskName = String(row.task_name ?? "").trim();
    if (!taskName) {
      skipped.push({ row: rowNum, reason: "Missing task_name." });
      continue;
    }

    const emails = String(row.assignee_emails ?? "")
      .split(/[,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) {
      skipped.push({ row: rowNum, reason: "Missing assignee_emails." });
      continue;
    }
    const unknownEmails = emails.filter((e) => !emailToId.has(e));
    if (unknownEmails.length > 0) {
      skipped.push({
        row: rowNum,
        reason: `Unknown or unassignable email(s): ${unknownEmails.join(", ")}.`,
      });
      continue;
    }

    const startDate = toDateString(row.start_date);
    if (!startDate) {
      skipped.push({ row: rowNum, reason: "Missing or invalid start_date (use YYYY-MM-DD)." });
      continue;
    }
    const endDate = toDateString(row.end_date);

    const recurrenceKindRaw = String(row.recurrence_kind ?? "").trim().toLowerCase();
    const recurrenceKind = (
      recurrenceKindRaw === "" ? "one_time" : recurrenceKindRaw
    ) as Enums<"recurrence_kind">;
    if (!RECURRENCE_KINDS.includes(recurrenceKind)) {
      skipped.push({
        row: rowNum,
        reason: `Invalid recurrence_kind "${recurrenceKindRaw}" (use one_time, daily, weekly, or monthly).`,
      });
      continue;
    }

    const intervalRaw = row.recurrence_interval;
    const recurrenceInterval =
      intervalRaw === "" || intervalRaw == null ? 1 : Math.max(1, Number(intervalRaw));
    if (Number.isNaN(recurrenceInterval)) {
      skipped.push({ row: rowNum, reason: "Invalid recurrence_interval." });
      continue;
    }

    const reminderRaw = String(row.reminder_enabled ?? "true").trim().toLowerCase();
    const reminderEnabled = !["false", "0", "no"].includes(reminderRaw);

    const description = String(row.description ?? "").trim() || null;
    const isRecurring = recurrenceKind !== "one_time";

    for (const email of emails) {
      const assigneeId = emailToId.get(email)!;
      const { data: task, error: insertError } = await supabase
        .from("tasks")
        .insert({
          org_id: appUser.org_id,
          created_by: appUser.id,
          assignee_id: assigneeId,
          task_name: taskName,
          description,
          is_recurring: isRecurring,
          recurrence_kind: recurrenceKind,
          recurrence_interval: recurrenceInterval,
          start_date: startDate,
          end_date: endDate,
          reminder_enabled: reminderEnabled,
        })
        .select("id")
        .single();

      if (insertError || !task) {
        skipped.push({
          row: rowNum,
          reason: `Could not create task for ${email}: ${insertError?.message ?? "unknown error"}.`,
        });
        continue;
      }

      const { error: genError } = await supabase.rpc("generate_task_instances", {
        p_task_id: task.id,
      });
      if (genError) {
        skipped.push({
          row: rowNum,
          reason: `Task created for ${email} but scheduling failed: ${genError.message}.`,
        });
        continue;
      }

      created++;
    }
  }

  if (created > 0) revalidatePath("/dashboard");
  return { error: null, created, skipped };
}
