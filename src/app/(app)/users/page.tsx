import { requireRole } from "@/lib/auth";
import { getOrgUsers, getOrgManagers } from "@/lib/org-data";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);

  const users = await getOrgUsers(appUser);
  const managers =
    appUser.system_role === "master_admin" && appUser.org_id
      ? await getOrgManagers(appUser.org_id)
      : [];

  const allowedRoles =
    appUser.system_role === "master_admin"
      ? (["user", "reporting_manager", "master_admin"] as const)
      : (["user"] as const);

  return (
    <UsersManager
      users={users}
      managers={managers}
      allowedRoles={[...allowedRoles]}
      showReportsTo={appUser.system_role === "master_admin"}
    />
  );
}
