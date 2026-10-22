import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PLATFORM } from "@/lib/config";
import { requireUser } from "@/lib/auth/guards";
import { boundingBox, fuzz, haversineKm } from "@/lib/geo";
import { volunteerStipendCents } from "@/lib/domain/pricing";

/** Open delivery tasks near the volunteer, plus the ones they've taken. */
export const GET = api(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat") ?? user.lat ?? env.defaultLat);
  const lng = Number(url.searchParams.get("lng") ?? user.lng ?? env.defaultLng);
  const box = boundingBox(lat, lng, PLATFORM.volunteerSearchKm);

  const listingSelect = { select: { title: true, unit: true, address: true, city: true, pickupEnd: true, pickupInstructions: true, ownerId: true } };
  const [open, mine] = await Promise.all([
    db.deliveryTask.findMany({
      where: { status: "OPEN", pickupLat: { gte: box.minLat, lte: box.maxLat }, pickupLng: { gte: box.minLng, lte: box.maxLng }, claim: { listing: { pickupEnd: { gt: new Date() } } } },
      include: { claim: { select: { quantity: true, claimantId: true, listing: listingSelect } } },
      take: 50,
    }),
    db.deliveryTask.findMany({
      where: { volunteerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { claim: { select: { id: true, quantity: true, dropAddress: true, pickupCode: true, listing: listingSelect } } },
    }),
  ]);

  return {
    open: open
      .filter((t) => t.claim.claimantId !== user.id && t.claim.listing.ownerId !== user.id)
      .map((t) => ({
        id: t.id,
        title: t.claim.listing.title,
        quantity: `${t.claim.quantity} ${t.claim.listing.unit}`,
        area: t.claim.listing.city,
        pickupLat: fuzz(t.pickupLat, 2),
        pickupLng: fuzz(t.pickupLng, 2),
        tripKm: t.distanceKm,
        awayKm: Math.round(haversineKm(lat, lng, t.pickupLat, t.pickupLng) * 10) / 10,
        pickupBy: t.claim.listing.pickupEnd,
        estStipendCents: volunteerStipendCents(t.distanceKm),
      }))
      .sort((a, b) => a.awayKm - b.awayKm),
    mine: mine.map((t) => ({
      id: t.id,
      claimId: t.claim.id,
      status: t.status,
      title: t.claim.listing.title,
      quantity: `${t.claim.quantity} ${t.claim.listing.unit}`,
      pickupAddress: t.claim.listing.address,
      pickupInstructions: t.claim.listing.pickupInstructions,
      dropAddress: t.claim.dropAddress,
      pickupBy: t.claim.listing.pickupEnd,
      // The volunteer shows this to the donor at collection.
      pickupCode: t.status === "ACCEPTED" ? t.claim.pickupCode : null,
      tripKm: t.distanceKm,
      stipendCents: t.stipendCents,
    })),
  };
});
