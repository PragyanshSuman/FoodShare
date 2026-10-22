import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { reportSchema } from "@/lib/validation";
import { createReport } from "@/lib/services/community";

export const POST = api(async (req) => {
  const user = await requireUser();
  const report = await createReport(user, await body(req, reportSchema));
  return { report: { id: report.id } };
});
