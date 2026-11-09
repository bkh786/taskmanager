import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isB2Path, stripB2Prefix, presignDownload } from "@/lib/b2";

/**
 * attachment_url on task_instances stores either a Backblaze B2 object key
 * (prefixed "b2:") or, for files uploaded before the B2 migration, a
 * Supabase Storage path (bucket is private in both cases).
 */
export async function getAttachmentSignedUrl(
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  if (isB2Path(path)) {
    try {
      return await presignDownload(stripB2Prefix(path));
    } catch {
      return null;
    }
  }
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

  const b2Paths = unique.filter(isB2Path);
  const legacyPaths = unique.filter((p) => !isB2Path(p));

  // Map keys are the stored attachment_url values (including any "b2:" prefix),
  // which is what callers look rows up by.
  await Promise.all(
    b2Paths.map(async (p) => {
      try {
        result.set(p, await presignDownload(stripB2Prefix(p)));
      } catch {
        // leave unsigned -- callers render "no preview" for missing entries
      }
    })
  );

  if (legacyPaths.length > 0) {
    const { data, error } = await client.storage
      .from("task-attachments")
      .createSignedUrls(legacyPaths, 3600);
    if (!error && data) {
      for (const entry of data) {
        if (entry.signedUrl && !entry.error) result.set(entry.path ?? "", entry.signedUrl);
      }
    }
  }
  return result;
}

/** Batch-signs many stored attachment paths -- used by list/report views. */
export async function getAttachmentSignedUrls(paths: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  return signMany(supabase, paths);
}

/** Same as getAttachmentSignedUrls, but via the service-role client -- the
 * Supabase bucket's SELECT policy scopes to the caller's own org, so a
 * platform_owner signing another tenant's legacy paths needs the RLS bypass,
 * same as the other platform-owner cross-tenant reads. (B2 keys are signed
 * with the app's own B2 credentials either way.) */
export async function getAttachmentSignedUrlsAdmin(paths: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  return signMany(admin, paths);
}
