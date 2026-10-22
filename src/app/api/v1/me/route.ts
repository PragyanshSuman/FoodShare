import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { profileSchema } from "@/lib/validation";
import { deleteAccount } from "@/lib/services/account";
import { destroySession } from "@/lib/auth/session";

export const GET = api(async () => {
  const user = await getCurrentUser();
  if (!user) return { user: null };
  const { passwordHash: _ph, ...safe } = user;
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return { user: safe, unread };
});

export const PATCH = api(async (req) => {
  const user = await requireUser();
  const input = await body(req, profileSchema);
  const updated = await db.user.update({ where: { id: user.id }, data: input });
  return { user: { id: updated.id, name: updated.name } };
});

export const DELETE = api(async () => {
  const user = await requireUser();
  await deleteAccount(user);
  await destroySession();
});
