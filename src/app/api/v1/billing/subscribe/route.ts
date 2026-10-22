import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { createSubscriptionOrder } from "@/lib/services/billing";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { period } = await body(req, z.object({ period: z.enum(["monthly", "yearly"]) }));
  return { checkout: await createSubscriptionOrder(user, period) };
});
