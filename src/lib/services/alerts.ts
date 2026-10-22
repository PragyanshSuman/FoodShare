import { db } from "../db";
import { PLATFORM } from "../config";
import { boundingBox, haversineKm } from "../geo";
import { enqueue } from "../jobs/queue";
import { notify } from "./notifications";

const MAX_ALERTS_PER_LISTING = 200;

/**
 * Fan a new listing out to matching saved searches. Respects NGO priority:
 * verified NGOs hear first; everyone else is alerted when the window opens.
 */
export async function matchAlerts(listingId: string, phase: "initial" | "public" = "initial") {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "ACTIVE" || listing.quantityAvailable === 0) return;

  const box = boundingBox(listing.lat, listing.lng, PLATFORM.maxRadiusKm);
  const alerts = await db.alertPreference.findMany({
    where: {
      active: true,
      userId: { not: listing.ownerId },
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
      user: { status: "ACTIVE" },
    },
    include: { user: { select: { id: true, organization: { select: { kind: true, verificationStatus: true } } } } },
    take: 2000,
  });

  const priorityOpen = listing.ngoPriorityUntil && listing.ngoPriorityUntil > new Date();
  const notified = new Set<string>();
  for (const a of alerts) {
    if (notified.size >= MAX_ALERTS_PER_LISTING) break;
    if (notified.has(a.userId)) continue;
    if (haversineKm(a.lat, a.lng, listing.lat, listing.lng) > a.radiusKm) continue;
    if (a.categories.length && !a.categories.includes(listing.category)) continue;
    if (a.dietTypes.length && !a.dietTypes.includes(listing.dietType)) continue;
    if (a.modes.length && !a.modes.includes(listing.mode)) continue;

    const ngo = a.user.organization?.kind === "NGO" && a.user.organization.verificationStatus === "VERIFIED";
    if (listing.audience === "VERIFIED_NGO_ONLY" && !ngo) continue;
    if (phase === "initial" && priorityOpen && !ngo) continue; // they get the "public" pass
    if (phase === "public" && ngo) continue; // already told

    notified.add(a.userId);
    await notify(a.userId, {
      type: "alert",
      title: `${listing.mode === "SALE" ? "Surplus deal" : "Free food"} near you: ${listing.title}`,
      body: `${listing.quantityAvailable} ${listing.unit} · pickup until ${listing.pickupEnd.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      link: `/listings/${listing.id}`,
      email: "digest",
    });
  }

  if (phase === "initial" && priorityOpen && listing.audience === "EVERYONE") {
    await enqueue("alerts.match", { listingId, phase: "public" }, { runAt: listing.ngoPriorityUntil! });
  }
}
