import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireStaff } from "@/lib/auth/guards";
import { reviewVerification } from "@/lib/services/community";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const staff = await requireStaff();
  const { approve, note } = await body(req, z.object({ approve: z.boolean(), note: z.string().max(500).optional() }));
  await reviewVerification(staff, (await params).id, approve, note);
});
