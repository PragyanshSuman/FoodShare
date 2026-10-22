import { api, body, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation";
import { signup } from "@/lib/services/auth";

export const POST = api(async (req) => {
  await rateLimit(`signup:${clientIp(req)}`, 5, 3600);
  const user = await signup(await body(req, signupSchema));
  return { user: { id: user.id, email: user.email, name: user.name } };
});
