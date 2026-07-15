import "server-only";
import { createClient } from "@/lib/supabase/server";

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
