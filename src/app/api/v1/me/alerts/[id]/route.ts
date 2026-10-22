import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await db.alertPreference.deleteMany({ where: { id, userId: user.id } });
});
