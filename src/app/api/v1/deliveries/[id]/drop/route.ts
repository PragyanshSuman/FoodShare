import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { confirmDrop } from "@/lib/services/claims";

/** Volunteer enters the recipient's drop code on arrival. */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { code } = await body(req, z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }));
  await confirmDrop(user, (await params).id, code);
});
