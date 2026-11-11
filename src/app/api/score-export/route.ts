import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentAppUser } from "@/lib/auth";
import { getReportRows, resolveReportRange } from "@/lib/report-data";
import { parseReportFilters } from "@/lib/report-params";
import { scoreTasks, isOnTime } from "@/lib/task-score";

const HEADERS = [
  "Project/Department",
  "Assignee Emp Code",
  "Assignee Name",
  "Designation",
  "Reporting Manager",
  "Task Name",
  "Due Date",
  "Completion Date",
  "Delay (days)",
  "Status",
];

function toDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * One employee's task score workbook for the period in the URL's filters:
 * the task list with live formulas (delay, on-time count, tasks, score).
 */
export async function GET(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.system_role === "platform_owner") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const assignee = sp.assignee;
  if (!assignee) return NextResponse.json({ error: "missing assignee" }, { status: 400 });

  const filters = parseReportFilters(sp);
  const range = resolveReportRange(filters);
  // getReportRows applies the viewer's own scope (org, reporting chain or self).
  const rows = (await getReportRows(appUser, filters)).filter((r) => r.assigneeId === assignee);
  if (rows.length === 0) return NextResponse.json({ error: "no tasks for that employee" }, { status: 404 });
  rows.sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : a.taskName.localeCompare(b.taskName)));

  const scored = scoreTasks(rows, range.to);
  const first = 5;
  const last = first + scored.length - 1;

  const ws: XLSX.WorkSheet = {};
  const put = (addr: string, cell: XLSX.CellObject) => {
    ws[addr] = cell;
  };

  const onTime = scored.filter(isOnTime).length;
  put("H1", { t: "s", v: "Completed on time" });
  put("I1", { t: "n", v: onTime, f: `COUNTIFS(I${first}:I${last},"<=0",J${first}:J${last},"Completed")` });
  put("H2", { t: "s", v: "Tasks assigned" });
  put("I2", { t: "n", v: scored.length, f: `COUNTA(F${first}:F${last})` });
  put("H3", { t: "s", v: "Task Score" });
  put("I3", { t: "n", v: scored.length ? onTime / scored.length : 0, f: "IF(I2=0,0,I1/I2)", z: "0%" });

  HEADERS.forEach((h, i) => put(`${String.fromCharCode(65 + i)}4`, { t: "s", v: h }));

  scored.forEach((t, i) => {
    const n = first + i;
    const r = t.row;
    put(`A${n}`, { t: "s", v: r.project });
    put(`B${n}`, { t: "s", v: r.employeeCode });
    put(`C${n}`, { t: "s", v: r.assigneeName });
    put(`D${n}`, { t: "s", v: r.designation });
    put(`E${n}`, { t: "s", v: r.managerName });
    put(`F${n}`, { t: "s", v: r.taskName });
    put(`G${n}`, { t: "d", v: toDate(r.dueDate), z: "dd-mmm-yy" });
    put(`H${n}`, { t: "d", v: toDate(t.completionDate), z: "dd-mmm-yy" });
    put(`I${n}`, { t: "n", v: t.delay, f: `MAX(0,H${n}-G${n})` });
    put(`J${n}`, { t: "s", v: t.completed ? "Completed" : "Open (to period end)" });
  });

  ws["!ref"] = `A1:J${last}`;
  ws["!cols"] = [22, 18, 22, 14, 24, 60, 12, 16, 12, 20].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Task Score");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true }) as Buffer;

  const safe = rows[0].assigneeName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="task-score-${safe}-${range.from}_to_${range.to}.xlsx"`,
    },
  });
}
