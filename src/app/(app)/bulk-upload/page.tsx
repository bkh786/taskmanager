import { redirect } from "next/navigation";

// Bulk task upload now lives in Task Management.
export default function BulkUploadPage() {
  redirect("/task-management?tab=upload");
}
