import { api, body, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { login } from "@/lib/services/auth";

export const POST = api(async (req) => {
  const input = await body(req, loginSchema);
  await rateLimit(`login:${clientIp(req)}`, 20, 900);
  await rateLimit(`login:${input.email}`, 8, 900); // slows password guessing on one account
  const user = await login(input.email, input.password);
  return { user: { id: user.id, name: user.name, role: user.role } };
});
