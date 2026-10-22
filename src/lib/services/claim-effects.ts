import type { Tx } from "../db";
import { PLATFORM } from "../config";
import { handoverCode } from "../crypto";
import { boundingBox, haversineKm } from "../geo";
import { ACTIVE_CLAIM_STATUSES, deriveListingStatus } from "../domain/claim-state";
import { notify, notifyMany } from "./notifications";

/** Recompute a listing's status after any claim/quantity change. */
export async function syncListingStatus(tx: Tx, listingId: string) {
  const listing = await tx.listing.findUniqueOrThrow({ where: { id: listingId } });
  const [activeClaims, completedClaims] = await Promise.all([
    tx.claim.count({ where: { listingId, status: { in: ACTIVE_CLAIM_STATUSES } } }),
    tx.claim.count({ where: { listingId, status: { in: ["COMPLETED", "NO_SHOW"] } } }),
  ]);
  const now = new Date();
  const next = deriveListingStatus({
    current: listing.status,
    quantityAvailable: listing.quantityAvailable,
    activeClaims,
    completedClaims,
    pastDeadline: listing.pickupEnd <= now || listing.expiresAt <= now,
  });
  if (next !== listing.status) await tx.listing.update({ where: { id: listingId }, data: { status: next } });
  return next;
}

/** Everything that happens once a claim is confirmed (free, approved or paid). */
export async function onClaimConfirmed(tx: Tx, claimId: string) {
  const claim = await tx.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { listing: true, claimant: { select: { name: true } } },
  });
  const { listing } = claim;
  await syncListingStatus(tx, listing.id);

  await notify(listing.ownerId, {
    type: "claim.confirmed",
    title: `New pickup: ${listing.title}`,
    body: `${claim.claimant.name} reserved ${claim.quantity} ${listing.unit}. Ask for their handover code at pickup.`,
    link: `/dashboard/claims/${claim.id}`,
    email: "now",
  }, tx);

  if (claim.fulfilment === "VOLUNTEER_DELIVERY" && claim.dropLat != null && claim.dropLng != null) {
    const distanceKm = Math.round(haversineKm(listing.lat, listing.lng, claim.dropLat, claim.dropLng) * 10) / 10;
    await tx.deliveryTask.create({
      data: {
        claimId: claim.id,
        pickupLat: listing.lat,
        pickupLng: listing.lng,
        dropLat: claim.dropLat,
        dropLng: claim.dropLng,
        distanceKm,
        dropCode: handoverCode(),
      },
    });
    const box = boundingBox(listing.lat, listing.lng, PLATFORM.volunteerSearchKm);
    const volunteers = await tx.user.findMany({
      where: {
        isVolunteer: true,
        status: "ACTIVE",
        emailVerifiedAt: { not: null },
        id: { notIn: [listing.ownerId, claim.claimantId] },
        lat: { gte: box.minLat, lte: box.maxLat },
        lng: { gte: box.minLng, lte: box.maxLng },
      },
      select: { id: true },
      take: 30,
    });
    await notifyMany(volunteers.map((v) => v.id), {
      type: "delivery.open",
      title: "Delivery needed nearby",
      body: `${claim.quantity} ${listing.unit} of ${listing.title}, ${distanceKm} km trip. Pickup by ${listing.pickupEnd.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`,
      link: "/dashboard/deliveries",
      email: "never",
    }, tx);
  }

  await notify(claim.claimantId, {
    type: "claim.confirmed",
    title: "Your reservation is confirmed",
    body:
      claim.fulfilment === "VOLUNTEER_DELIVERY"
        ? `We're finding a volunteer to bring ${listing.title} to you.`
        : `Pick up ${listing.title} before the window closes. Your handover code is in the app.`,
    link: `/dashboard/claims/${claim.id}`,
    email: "now",
  }, tx);
}
