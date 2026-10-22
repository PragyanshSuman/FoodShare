import { AwsClient } from "aws4fetch";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";
import { hmacHex, randomToken, safeEqual } from "./crypto";
import { badRequest } from "./errors";

/**
 * Two drivers behind one interface:
 *  - local: files on disk, uploads via a signed same-origin PUT (dev / single VPS)
 *  - s3:    Cloudflare R2 (zero egress fees) or any S3 — browser uploads directly
 *           with a presigned URL, so image bytes never pass through our server.
 */

export type UploadPurpose = "listing" | "avatar" | "verification";
const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES: Record<UploadPurpose, number> = {
  listing: 1_000_000, // client compresses to ~150 KB; 1 MB is a hard cap
  avatar: 500_000,
  verification: 5_000_000,
};
const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

const isPrivate = (key: string) => key.startsWith("private/");

let s3: AwsClient | null = null;
const s3Client = () =>
  (s3 ??= new AwsClient({
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
    service: "s3",
    region: env.s3Region,
  }));
const s3ObjectUrl = (key: string) => `${env.s3Endpoint.replace(/\/$/, "")}/${env.s3Bucket}/${key}`;

export async function createUpload(purpose: UploadPurpose, contentType: string, size: number, userId: string) {
  if (!ALLOWED_TYPES.includes(contentType)) throw badRequest("Unsupported file type");
  if (purpose !== "verification" && contentType === "application/pdf") throw badRequest("Photos must be images");
  if (size <= 0 || size > MAX_BYTES[purpose]) throw badRequest(`File too large (max ${MAX_BYTES[purpose] / 1000} KB)`);

  const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
  const prefix = purpose === "verification" ? "private/verification" : `public/${purpose}`;
  const key = `${prefix}/${userId}/${Date.now()}-${randomToken(6)}.${ext}`;

  if (env.storageDriver === "s3") {
    const url = new URL(s3ObjectUrl(key));
    url.searchParams.set("X-Amz-Expires", "600");
    const signed = await s3Client().sign(new Request(url, { method: "PUT", headers: { "content-type": contentType } }), {
      aws: { signQuery: true },
    });
    return { key, uploadUrl: signed.url, headers: { "content-type": contentType } };
  }

  const expires = Date.now() + 10 * 60_000;
  const sig = hmacHex(`${key}:${contentType}:${size}:${expires}`);
  const qs = new URLSearchParams({ key, ct: contentType, size: String(size), expires: String(expires), sig });
  return { key, uploadUrl: `/api/v1/uploads/local?${qs}`, headers: { "content-type": contentType } };
}

/** Local driver: verify the signed PUT and persist the bytes. */
export async function acceptLocalUpload(params: URLSearchParams, bytes: ArrayBuffer) {
  const key = params.get("key") ?? "";
  const ct = params.get("ct") ?? "";
  const size = Number(params.get("size"));
  const expires = Number(params.get("expires"));
  const sig = params.get("sig") ?? "";
  if (!safeEqual(sig, hmacHex(`${key}:${ct}:${size}:${expires}`)) || Date.now() > expires) throw badRequest("Upload link expired");
  if (bytes.byteLength > size || key.includes("..")) throw badRequest("Upload does not match the signed request");
  const file = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(bytes));
}

export async function readLocalFile(key: string) {
  if (key.includes("..")) throw badRequest("Bad key");
  return fs.readFile(path.join(LOCAL_ROOT, key));
}

/** Public URL for listing photos / avatars (served straight from the CDN in production). */
export function publicFileUrl(key: string) {
  if (isPrivate(key)) throw new Error("Private files need signedFileUrl()");
  return env.storageDriver === "s3" && env.s3PublicUrl ? `${env.s3PublicUrl}/${key}` : `/api/v1/files/${key}`;
}

/** Short-lived URL for private documents; caller must have authorised access. */
export async function signedFileUrl(key: string) {
  if (env.storageDriver === "s3") {
    const url = new URL(s3ObjectUrl(key));
    url.searchParams.set("X-Amz-Expires", "300");
    const signed = await s3Client().sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
    return signed.url;
  }
  const expires = Date.now() + 5 * 60_000;
  return `/api/v1/files/${key}?expires=${expires}&sig=${hmacHex(`get:${key}:${expires}`)}`;
}

export function verifyLocalGet(key: string, expires: string | null, sig: string | null) {
  if (!isPrivate(key)) return true;
  if (!expires || !sig || Date.now() > Number(expires)) return false;
  return safeEqual(sig, hmacHex(`get:${key}:${expires}`));
}

export async function deleteFile(key: string) {
  if (env.storageDriver === "s3") {
    await s3Client().fetch(s3ObjectUrl(key), { method: "DELETE" });
  } else {
    await fs.rm(path.join(LOCAL_ROOT, key), { force: true });
  }
}
