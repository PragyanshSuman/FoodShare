import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { startCheckout } from "@/lib/services/billing";

/** Resume payment for a held reservation (e.g. the buyer closed the payment tab). */
export const POST = api<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const claim = await db.claim.findUnique({ where: { id: (await params).id }, include: { order: true, listing: true } });
  if (!claim || claim.claimantId !== user.id || !claim.order) throw notFound("Reservation");
  if (claim.status !== "PENDING_PAYMENT" || !["CREATED", "FAILED"].includes(claim.order.status)) throw conflict("Nothing to pay for this reservation");
  const order = await db.order.update({ where: { id: claim.order.id }, data: { status: "CREATED" } });
  return { checkout: await startCheckout(order, user.email, `${claim.quantity} × ${claim.listing.title}`, `/dashboard/claims/${claim.id}`) };
});
