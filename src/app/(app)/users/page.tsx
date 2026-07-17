import { requireRole } from "@/lib/auth";
import { getOrgUsers, getOrgManagers, getOrgProjects, getOrgDesignations } from "@/lib/org-data";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const appUser = await requireRole(["master_admin", "reporting_manager"]);

  const [users, managers, projects, designations] = await Promise.all([
    getOrgUsers(appUser),
    appUser.system_role === "master_admin" && appUser.org_id
      ? getOrgManagers(appUser.org_id)
      : Promise.resolve([]),
    appUser.org_id ? getOrgProjects(appUser.org_id) : Promise.resolve([]),
    appUser.org_id ? getOrgDesignations(appUser.org_id) : Promise.resolve([]),
  ]);

  const allowedRoles =
    appUser.system_role === "master_admin"
      ? (["user", "reporting_manager", "master_admin"] as const)
      : (["user"] as const);

  return (
    <UsersManager
      users={users}
      managers={managers}
      projects={projects}
      designations={designations}
      allowedRoles={[...allowedRoles]}
      showReportsTo={appUser.system_role === "master_admin"}
    />
  );
}
