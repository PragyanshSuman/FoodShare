import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { setScheduleActive } from "@/lib/services/schedules";

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { active } = await body(req, z.object({ active: z.boolean() }));
  return { schedule: await setScheduleActive(user, (await params).id, active) };
});
