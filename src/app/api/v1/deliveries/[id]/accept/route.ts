import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { acceptDelivery } from "@/lib/services/claims";

export const POST = api<{ id: string }>(async (_req, { params }) => {
  await acceptDelivery(await requireUser(), (await params).id);
});
