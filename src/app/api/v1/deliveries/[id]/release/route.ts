import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { releaseDelivery } from "@/lib/services/claims";

export const POST = api<{ id: string }>(async (_req, { params }) => {
  await releaseDelivery(await requireUser(), (await params).id);
});
