import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTenants } from "@/lib/tenant-data";
import { BulkUsersUploadForm } from "@/components/bulk-upload-users/upload-form";

export default async function BulkUploadUsersPage() {
  const appUser = await requireRole(["master_admin", "platform_owner"]);

  const orgs =
    appUser.system_role === "platform_owner"
      ? (await getTenants()).map((t) => ({ id: t.id, slug: t.slug, name: t.name }))
      : await (async () => {
          const supabase = await createClient();
          const { data } = await supabase
            .from("organizations")
            .select("id, slug, name")
            .eq("id", appUser.org_id ?? "")
            .single();
          return data ? [data] : [];
        })();

  return (
    <div>
      <div className="text-[22px] font-bold text-text-main mb-0.5">Bulk Upload Users</div>
      <div className="text-[13.5px] text-text-sub mb-5">
        Create many users at once from a spreadsheet.
      </div>
      <BulkUsersUploadForm orgs={orgs} />
    </div>
  );
}
