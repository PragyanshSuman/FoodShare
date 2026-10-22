import { z } from "zod";
import { api, body } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guards";
import { listingPatchSchema } from "@/lib/validation";
import { cancelListing, getListingForViewer, updateListing } from "@/lib/services/listings";

type P = { id: string };

export const GET = api<P>(async (_req, { params }) => {
  const result = await getListingForViewer((await params).id, await getCurrentUser());
  if (!result) throw notFound("Listing");
  return { listing: result.listing, myClaim: result.myClaim ? { id: result.myClaim.id, status: result.myClaim.status } : null };
});

export const PATCH = api<P>(async (req, { params }) => {
  const user = await requireUser();
  const listing = await updateListing(user, (await params).id, await body(req, listingPatchSchema));
  return { listing: { id: listing.id } };
});

/** Withdraw the listing (cancels and refunds all open reservations). */
export const DELETE = api<P>(async (req, { params }) => {
  const user = await requireUser();
  const { reason } = await body(req, z.object({ reason: z.string().trim().min(3).max(200) }));
  await cancelListing(user, (await params).id, reason);
});
