import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { scheduleSchema } from "@/lib/validation";
import { createSchedule } from "@/lib/services/schedules";

export const GET = api(async () => {
  const user = await requireUser();
  return { schedules: await db.recurringSchedule.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }) };
});

export const POST = api(async (req) => {
  const user = await requireUser();
  return { schedule: await createSchedule(user, await body(req, scheduleSchema)) };
});
