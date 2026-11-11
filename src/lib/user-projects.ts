import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Client = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

/** user id -> every project they belong to (a person can be in several). */
export async function loadUserProjects(
  client: Client,
  userIds: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 100) chunks.push(userIds.slice(i, i + 100));

  for (let g = 0; g < chunks.length; g += 8) {
    await Promise.all(
      chunks.slice(g, g + 8).map(async (chunk) => {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await (client as Awaited<ReturnType<typeof createClient>>)
            .from("user_projects")
            .select("user_id, project_id")
            .in("user_id", chunk)
            .order("user_id")
            .order("project_id")
            .range(from, from + 999);
          if (error) throw error;
          for (const r of data ?? []) {
            const list = out.get(r.user_id);
            if (list) list.push(r.project_id);
            else out.set(r.user_id, [r.project_id]);
          }
          if ((data?.length ?? 0) < 1000) break;
        }
      })
    );
  }
  return out;
}

type WithProject = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  project_ids?: string[];
};

/**
 * Fills in every project of each person. The primary project (the one stored on
 * the user) comes first; `project_name` becomes the comma-separated list.
 */
export async function attachProjects<T extends WithProject>(
  client: Client,
  people: T[],
  projectNames: Map<string, string>
): Promise<(T & { project_ids: string[] })[]> {
  const map = await loadUserProjects(
    client,
    people.map((p) => p.id)
  );
  return people.map((p) => {
    const set = new Set<string>();
    if (p.project_id) set.add(p.project_id);
    for (const id of map.get(p.id) ?? []) set.add(id);
    const ids = [...set];
    const names = ids.map((id) => projectNames.get(id)).filter((n): n is string => !!n);
    return { ...p, project_ids: ids, project_name: names.length ? names.join(", ") : null };
  });
}

/** Replaces a user's projects. The first becomes their primary project. */
export async function setUserProjects(userId: string, projectIds: string[]): Promise<string | null> {
  const admin = createAdminClient();
  const ids = [...new Set(projectIds)];
  const { error: delError } = await admin.from("user_projects").delete().eq("user_id", userId);
  if (delError) return delError.message;
  if (ids.length > 0) {
    const { error } = await admin
      .from("user_projects")
      .insert(ids.map((project_id) => ({ user_id: userId, project_id })));
    if (error) return error.message;
  }
  return null;
}

/** The projects a person belongs to. */
export async function getUserProjectIds(userId: string, primary: string | null): Promise<string[]> {
  const map = await loadUserProjects(createAdminClient(), [userId]);
  const set = new Set<string>();
  if (primary) set.add(primary);
  for (const id of map.get(userId) ?? []) set.add(id);
  return [...set];
}
