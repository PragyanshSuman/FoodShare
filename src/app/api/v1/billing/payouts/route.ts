import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { requestPayout } from "@/lib/services/billing";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { amountCents, destination } = await body(
    req,
    z.object({ amountCents: z.number().int().positive(), destination: z.string().trim().min(4).max(120) }),
  );
  return { payout: await requestPayout(user, amountCents, destination) };
});
