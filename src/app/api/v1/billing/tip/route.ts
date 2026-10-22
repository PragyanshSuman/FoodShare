import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { createTipOrder } from "@/lib/services/billing";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { amountCents } = await body(req, z.object({ amountCents: z.number().int().min(100).max(10_000_000) }));
  return { checkout: await createTipOrder(user, amountCents) };
});
