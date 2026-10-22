import { api } from "@/lib/http";
import { badRequest, forbidden } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { entitlementsFor } from "@/lib/services/listings";
import { organizationReport, reportCsv } from "@/lib/services/impact";

/** CSR / ESG export for Pro organisations. */
export const GET = api(async (req) => {
  const user = await requireUser();
  if (!user.organization) throw badRequest("Reports are for organisations");
  if (!entitlementsFor(user).csvExport) throw forbidden("CSV export is a Pro feature");
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 90 * 86_400_000);
  const { rows } = await organizationReport(user.organization.id, from, to);
  return new Response(reportCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="foodshare-impact-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`,
    },
  });
});
