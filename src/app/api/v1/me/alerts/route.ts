import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { alertSchema } from "@/lib/validation";

export const GET = api(async () => {
  const user = await requireUser();
  return { alerts: await db.alertPreference.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) };
});

export const POST = api(async (req) => {
  const user = await requireUser();
  const input = await body(req, alertSchema);
  if ((await db.alertPreference.count({ where: { userId: user.id } })) >= 5) throw conflict("You can save up to 5 alerts");
  return { alert: await db.alertPreference.create({ data: { ...input, userId: user.id } }) };
});
