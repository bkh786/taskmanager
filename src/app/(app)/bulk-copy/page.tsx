import { requireRole } from "@/lib/auth";
import { getAssignableEmployees, getUserActiveTasks } from "@/lib/org-data";
import { SourceSelect } from "@/components/bulk-copy/source-select";
import { CopyForm } from "@/components/bulk-copy/copy-form";

export default async function BulkCopyPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const appUser = await requireRole(["reporting_manager"]);
  const sp = await searchParams;
  const requestedSourceId = sp.source ?? "";

  const employees = await getAssignableEmployees(appUser);
  // The source picker is already scoped to `employees` in the UI, but the
  // id still arrives via the URL -- ignore it if it's not actually someone
  // in this manager's reporting chain, rather than trusting it outright.
  const sourceId = employees.some((e) => e.id === requestedSourceId) ? requestedSourceId : "";
  const tasks = sourceId ? await getUserActiveTasks(sourceId) : [];
  const targetCandidates = employees.filter((e) => e.id !== sourceId);

  return (
    <div>
      <div className="text-[22px] font-bold text-text-main mb-0.5">
        Bulk Task Copy
      </div>
      <div className="text-[13.5px] text-text-sub mb-5">
        Copy a user&apos;s tasks to one or more teammates
      </div>

      <div className="mb-5">
        <label className="text-xs font-semibold text-text-sub block mb-1.5">
          Source user
        </label>
        <SourceSelect employees={employees} sourceId={sourceId} />
      </div>

      {sourceId ? (
        <CopyForm key={sourceId} sourceId={sourceId} tasks={tasks} targetCandidates={targetCandidates} />
      ) : (
        <div className="text-[13px] text-text-faint">
          Choose a source user to see their tasks.
        </div>
      )}
    </div>
  );
}
