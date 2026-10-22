import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { createUpload } from "@/lib/storage";

const schema = z.object({
  purpose: z.enum(["listing", "avatar", "verification"]),
  contentType: z.string(),
  size: z.number().int().positive(),
});

/** Step 1 of an upload: get a short-lived URL, then PUT the bytes straight to storage. */
export const POST = api(async (req) => {
  const user = await requireUser();
  await rateLimit(`upload:${user.id}`, 40, 3600);
  const { purpose, contentType, size } = await body(req, schema);
  return createUpload(purpose, contentType, size, user.id);
});
