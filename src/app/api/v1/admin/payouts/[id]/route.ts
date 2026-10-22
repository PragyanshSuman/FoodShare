import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/guards";
import { processPayout } from "@/lib/services/billing";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { approve, reference, note } = await body(
    req,
    z.object({ approve: z.boolean(), reference: z.string().max(100).optional(), note: z.string().max(300).optional() }),
  );
  await processPayout(admin.id, (await params).id, approve, reference, note);
});
