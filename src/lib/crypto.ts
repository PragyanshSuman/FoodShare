import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const hmacHex = (data: string, secret = env.appSecret) => createHmac("sha256", secret).update(data).digest("hex");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Short numeric code for in-person handovers (read aloud / typed by the donor). */
export const handoverCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
