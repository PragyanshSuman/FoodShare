import type { AuthTokenType } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { badRequest, conflict, unauthorized } from "../errors";
import { randomToken, sha256 } from "../crypto";
import { emailLayout } from "../email";
import { enqueue } from "../jobs/queue";
import { createSession, hashPassword, verifyPassword } from "../auth/session";
import type { z } from "zod";
import type { signupSchema } from "../validation";
import { audit } from "./audit";

const TOKEN_TTL: Record<AuthTokenType, number> = { EMAIL_VERIFY: 48 * 3600_000, PASSWORD_RESET: 3600_000 };

export async function signup(input: z.infer<typeof signupSchema>) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists");
  if (input.accountType !== "INDIVIDUAL" && !input.organizationName) throw badRequest("Enter your organisation's name");

  const passwordHash = await hashPassword(input.password);
  const user = await db.$transaction(async (tx) => {
    const org =
      input.accountType === "INDIVIDUAL"
        ? null
        : await tx.organization.create({
            data: {
              name: input.organizationName!,
              kind: input.accountType === "NGO" ? "NGO" : "BUSINESS",
              category: input.organizationCategory || (input.accountType === "NGO" ? "ngo" : "restaurant"),
            },
          });
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        accountType: input.accountType,
        isVolunteer: input.isVolunteer,
        organizationId: org?.id ?? null,
      },
    });
    await audit(user.id, "user.signup", "User", user.id, { accountType: input.accountType }, tx);
    return user;
  });

  await sendAuthEmail(user.id, user.email, "EMAIL_VERIFY");
  await createSession(user.id);
  return user;
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Same error + similar timing whether or not the account exists.
  const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok || user.status === "DELETED") throw unauthorized("Incorrect email or password");

  if (user.status === "SUSPENDED" && user.suspendedUntil && user.suspendedUntil < new Date()) {
    await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE", suspendedUntil: null } });
  }
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await createSession(user.id);
  return user;
}

export async function sendAuthEmail(userId: string, email: string, type: AuthTokenType) {
  const token = randomToken();
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }); // invalidate older links
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) } });

  const verify = type === "EMAIL_VERIFY";
  const url = `${env.appUrl}/${verify ? "verify-email" : "reset-password"}?token=${token}`;
  const html = verify
    ? emailLayout("Confirm your email", "<p>Confirm your email to start sharing and claiming food.</p>", { label: "Confirm email", url })
    : emailLayout("Reset your password", "<p>Someone asked to reset your FoodShare password. This link works for 1 hour.</p><p>If it wasn't you, ignore this email.</p>", { label: "Choose a new password", url });
  await enqueue("email.send", { to: email, subject: verify ? "Confirm your FoodShare email" : "Reset your FoodShare password", html, text: `${verify ? "Confirm your email" : "Reset your password"}: ${url}` });
}

async function consumeToken(token: string, type: AuthTokenType) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) throw badRequest("This link is invalid or has expired");
  await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row;
}

export async function verifyEmail(token: string) {
  const row = await consumeToken(token, "EMAIL_VERIFY");
  await db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status !== "DELETED") await sendAuthEmail(user.id, user.email, "PASSWORD_RESET");
  // Always succeed: never reveal which emails are registered.
}

export async function resetPassword(token: string, password: string) {
  const row = await consumeToken(token, "PASSWORD_RESET");
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: row.userId } }), // sign out everywhere
  ]);
}
