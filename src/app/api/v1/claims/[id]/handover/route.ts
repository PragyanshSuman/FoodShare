import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { verifyHandover } from "@/lib/services/claims";

/** Donor enters the 6-digit code shown by the person collecting. */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { code } = await body(req, z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }));
  await verifyHandover(user, (await params).id, code);
});
