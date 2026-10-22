import { api } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { getClaimForViewer } from "@/lib/services/claims";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const result = await getClaimForViewer(user, (await params).id);
  if (!result) throw notFound("Claim");
  return result;
});
