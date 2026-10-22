import { z } from "zod";
import { api, body } from "@/lib/http";
import { verifyEmail } from "@/lib/services/auth";

export const POST = api(async (req) => {
  const { token } = await body(req, z.object({ token: z.string().min(10) }));
  await verifyEmail(token);
});
