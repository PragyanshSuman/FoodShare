import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { createSponsorshipOrder } from "@/lib/services/billing";

const schema = z.object({
  amountCents: z.number().int().min(100).max(100_000_000),
  displayName: z.string().trim().min(2).max(80),
  message: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().url().max(200).optional().nullable(),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  return { checkout: await createSponsorshipOrder(user, await body(req, schema)) };
});
