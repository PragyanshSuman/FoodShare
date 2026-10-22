import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { cancelClaim } from "@/lib/services/claims";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { reason } = await body(req, z.object({ reason: z.string().trim().min(3).max(200) }));
  await cancelClaim(user, (await params).id, reason);
});
