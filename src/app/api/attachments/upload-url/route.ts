import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  presignUpload,
} from "@/lib/b2";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/**
 * Issues a short-lived presigned PUT URL so the browser can upload proof of
 * completion straight to Backblaze B2. Same rule as completeTaskInstance:
 * only the assignee may attach proof to their own instance.
 */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser?.org_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    instanceId?: string;
    contentType?: string;
    size?: number;
  } | null;
  const instanceId = body?.instanceId;
  const contentType = body?.contentType ?? "";
  const size = Number(body?.size);

  if (!instanceId || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Only images and PDFs are allowed." }, { status: 400 });
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB).` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: instance } = await supabase
    .from("task_instances")
    .select("assignee_id")
    .eq("id", instanceId)
    .single();
  if (!instance) {
    return NextResponse.json({ error: "Task instance not found." }, { status: 404 });
  }
  if (instance.assignee_id !== appUser.id) {
    return NextResponse.json(
      { error: "Only the assignee can attach proof to this task." },
      { status: 403 }
    );
  }

  const key = `${appUser.org_id}/${instanceId}/${Date.now()}.${EXT_BY_TYPE[contentType]}`;
  const uploadUrl = await presignUpload(key, contentType, size);

  return NextResponse.json({ uploadUrl, key });
}
