import { z } from "zod";
import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).max(100).optional() }));
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
});
