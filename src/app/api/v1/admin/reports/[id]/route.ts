import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireStaff } from "@/lib/auth/guards";
import { resolveReport } from "@/lib/services/community";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const staff = await requireStaff();
  const { action, note, suspendDays } = await body(
    req,
    z.object({
      action: z.enum(["dismiss", "remove_listing", "suspend_user", "warn_user"]),
      note: z.string().trim().min(3).max(500),
      suspendDays: z.number().int().min(1).max(365).optional(),
    }),
  );
  await resolveReport(staff, (await params).id, action, note, suspendDays);
});
