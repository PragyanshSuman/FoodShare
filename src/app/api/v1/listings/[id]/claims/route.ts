import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { claimSchema } from "@/lib/validation";
import { createClaim } from "@/lib/services/claims";

type P = { id: string };

/** Reserve food from a listing. Returns a checkout for paid surplus. */
export const POST = api<P>(async (req, { params }) => {
  const user = await requireUser();
  await rateLimit(`claim:${user.id}`, 15, 3600);
  const { claim, checkout } = await createClaim(user, (await params).id, await body(req, claimSchema));
  return { claim: { id: claim.id, status: claim.status }, checkout };
});

/** Donor's view of who reserved their food. */
export const GET = api<P>(async (_req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  const listing = await db.listing.findUnique({ where: { id }, select: { ownerId: true } });
  if (!listing) throw notFound("Listing");
  if (listing.ownerId !== user.id) throw forbidden();
  const claims = await db.claim.findMany({
    where: { listingId: id },
    orderBy: { createdAt: "desc" },
    include: { claimant: { select: { name: true, ratingAvg: true, ratingCount: true, completedCount: true, organization: { select: { name: true, verificationStatus: true } } } } },
  });
  return { claims: claims.map(({ pickupCode: _hidden, ...c }) => c) };
});
