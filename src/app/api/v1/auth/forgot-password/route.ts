import { z } from "zod";
import { api, body, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/lib/services/auth";

export const POST = api(async (req) => {
  await rateLimit(`forgot:${clientIp(req)}`, 5, 3600);
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  await requestPasswordReset(email);
});
