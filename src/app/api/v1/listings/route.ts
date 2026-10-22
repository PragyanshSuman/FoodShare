import { api, body, query } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { listingSchema, searchSchema } from "@/lib/validation";
import { createListing, searchListings } from "@/lib/services/listings";

export const GET = api(async (req) => {
  const params = query(req, searchSchema);
  return searchListings(await getCurrentUser(), params);
});

export const POST = api(async (req) => {
  const user = await requireUser();
  await rateLimit(`listing:${user.id}`, 30, 3600);
  const listing = await createListing(user, await body(req, listingSchema));
  return { listing: { id: listing.id } };
});
