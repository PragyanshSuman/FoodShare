import { z } from "zod";
import { api, body } from "@/lib/http";
import { resetPassword } from "@/lib/services/auth";

export const POST = api(async (req) => {
  const { token, password } = await body(req, z.object({ token: z.string().min(10), password: z.string().min(8).max(128) }));
  await resetPassword(token, password);
});
