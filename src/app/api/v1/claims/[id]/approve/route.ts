import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { decideApproval } from "@/lib/services/claims";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { approve, reason } = await body(req, z.object({ approve: z.boolean(), reason: z.string().max(200).optional() }));
  await decideApproval(user, (await params).id, approve, reason);
});
