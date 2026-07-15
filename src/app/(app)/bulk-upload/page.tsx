import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { UploadForm } from "@/components/bulk-upload/upload-form";

export default async function BulkUploadPage() {
  await requireRole(["master_admin", "reporting_manager"]);

  return (
    <div>
      <Link href="/dashboard" className="text-[13px] text-text-sub mb-4 inline-block">
        ← Back to Dashboard
      </Link>
      <div className="text-[22px] font-bold text-text-main mb-0.5">
        Bulk Task Creation
      </div>
      <div className="text-[13.5px] text-text-sub mb-5">
        Create many tasks at once from a spreadsheet — one task per assignee.
      </div>
      <UploadForm />
    </div>
  );
}
