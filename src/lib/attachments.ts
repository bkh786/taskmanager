import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** attachment_url on task_instances stores a storage path (bucket is private). */
export async function getAttachmentSignedUrl(
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("task-attachments")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

async function signMany(
  client: SupabaseClient,
  paths: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const { data, error } = await client.storage
    .from("task-attachments")
    .createSignedUrls(unique, 3600);
  if (error || !data) return result;

  for (const entry of data) {
    if (entry.signedUrl && !entry.error) result.set(entry.path ?? "", entry.signedUrl);
  }
  return result;
}

/** Batch-signs many storage paths in one call -- used by list/report views. */
export async function getAttachmentSignedUrls(paths: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  return signMany(supabase, paths);
}

/** Same as getAttachmentSignedUrls, but via the service-role client -- the
 * bucket's SELECT policy scopes to the caller's own org, so a platform_owner
 * signing another tenant's attachment paths needs the RLS bypass, same as
 * the other platform-owner cross-tenant reads. */
export async function getAttachmentSignedUrlsAdmin(paths: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  return signMany(admin, paths);
}
