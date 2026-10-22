import { z } from "zod";
import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  const sub = await body(req, subSchema);
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
});

export const DELETE = api(async (req) => {
  const user = await requireUser();
  const { endpoint } = await body(req, z.object({ endpoint: z.string() }));
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
});
