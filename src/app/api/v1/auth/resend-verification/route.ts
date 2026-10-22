import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { badRequest } from "@/lib/errors";
import { sendAuthEmail } from "@/lib/services/auth";

export const POST = api(async () => {
  const user = await requireUser();
  if (user.emailVerifiedAt) throw badRequest("Your email is already verified");
  await rateLimit(`verify:${user.id}`, 3, 3600);
  await sendAuthEmail(user.id, user.email, "EMAIL_VERIFY");
});
