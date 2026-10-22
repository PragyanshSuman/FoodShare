import { cache } from "react";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "../crypto";

export const SESSION_COOKIE = "fs_session";
const SESSION_DAYS = 30;
const RENEW_WHEN_DAYS_LEFT = 15;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Current user (with organisation) or null. Memoised per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { organization: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.user.status === "DELETED") {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Sliding expiry, written at most once every few weeks per session.
  if (session.expiresAt.getTime() - now < RENEW_WHEN_DAYS_LEFT * 86_400_000) {
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(now + SESSION_DAYS * 86_400_000) },
    });
  }
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
