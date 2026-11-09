import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** attachment_url values stored in B2 carry this prefix; anything without it is a legacy Supabase Storage path. */
export const B2_PREFIX = "b2:";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export function isB2Path(path: string): boolean {
  return path.startsWith(B2_PREFIX);
}

export function stripB2Prefix(path: string): string {
  return path.slice(B2_PREFIX.length);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (Backblaze B2 storage config).`);
  return value;
}

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const raw = requireEnv("B2_ENDPOINT");
  cached = new S3Client({
    region: requireEnv("B2_REGION"),
    endpoint: raw.startsWith("http") ? raw : `https://${raw}`,
    credentials: {
      accessKeyId: requireEnv("B2_KEY_ID"),
      secretAccessKey: requireEnv("B2_APPLICATION_KEY"),
    },
    forcePathStyle: true,
    // B2 rejects the CRC32 checksum headers newer SDK versions add by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cached;
}

function bucket(): string {
  return requireEnv("B2_BUCKET_NAME");
}

/** Short-lived URL the browser PUTs the file to directly (bypasses Vercel's request-size limit). */
export async function presignUpload(key: string, contentType: string, size: number): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: 300, signableHeaders: new Set(["content-type", "content-length"]) }
  );
}

export async function presignDownload(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn,
  });
}

/** Returns the stored object's size/type, or null if it doesn't exist. */
export async function headObject(
  key: string
): Promise<{ size: number; contentType: string | undefined } | null> {
  try {
    const res = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType };
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw e;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
