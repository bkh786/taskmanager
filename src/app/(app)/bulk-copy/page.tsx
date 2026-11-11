import { redirect } from "next/navigation";

// Bulk copy now lives in Task Management.
export default async function BulkCopyPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sp = await searchParams;
  redirect(`/task-management?tab=copy${sp.source ? `&source=${encodeURIComponent(sp.source)}` : ""}`);
}
