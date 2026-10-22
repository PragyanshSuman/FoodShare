import { Prisma, type Listing, type Organization } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { PLANS, PLATFORM } from "../config";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { boundingBox, fuzz } from "../geo";
import { listingViolations } from "../domain/listing-rules";
import { ACTIVE_CLAIM_STATUSES } from "../domain/claim-state";
import { discountPercent } from "../money";
import { publicFileUrl } from "../storage";
import { enqueue } from "../jobs/queue";
import { isStaff } from "../auth/guards";
import type { CurrentUser } from "../auth/session";
import type { ListingInput } from "../validation";
import { audit } from "./audit";
import { cancelClaim } from "./claims";
import { syncListingStatus } from "./claim-effects";

export const entitlementsFor = (user: Pick<CurrentUser, "organization">) => PLANS[user.organization?.plan ?? "FREE"];

type Viewer = CurrentUser | null;

function assertCanPost(user: CurrentUser) {
  if (!user.emailVerifiedAt) throw forbidden("Verify your email before posting food");
  if (user.status !== "ACTIVE") throw forbidden("Your account cannot post right now");
}

export async function createListing(user: CurrentUser, input: ListingInput, opts: { scheduleId?: string } = {}) {
  assertCanPost(user);
  const org = user.organization;

  if (input.mode === "SALE") {
    // Selling food commercially needs a licensed business (e.g. FSSAI in India).
    if (!org || org.kind !== "BUSINESS") throw forbidden("Only food businesses can sell surplus");
    if (org.verificationStatus !== "VERIFIED") throw forbidden("Verify your business (licence documents) before selling surplus");
  }
  if (input.audience === "VERIFIED_NGO_ONLY" && !org) throw badRequest("NGO-only listings are for business donors");

  const ent = entitlementsFor(user);
  const active = await db.listing.count({ where: { ownerId: user.id, status: { in: ["ACTIVE", "RESERVED"] } } });
  if (active >= ent.maxActiveListings) {
    throw forbidden(`Your plan allows ${ent.maxActiveListings} active listings. Upgrade to Pro for more.`);
  }

  const violations = listingViolations({ ...input, preparedAt: input.preparedAt ?? null });
  if (violations.length) throw badRequest(violations[0], { violations });

  let { address, city, lat, lng } = input;
  if (input.locationId) {
    const loc = await db.location.findFirst({ where: { id: input.locationId, organizationId: org?.id ?? "-" } });
    if (!loc) throw badRequest("Unknown pickup location");
    ({ address, city, lat, lng } = loc);
  }

  const now = new Date();
  const listing = await db.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
        ownerId: user.id,
        organizationId: org?.id ?? null,
        locationId: input.locationId ?? null,
        scheduleId: opts.scheduleId ?? null,
        mode: input.mode,
        status: "ACTIVE",
        title: input.title,
        description: input.description,
        category: input.category,
        dietType: input.dietType,
        allergens: input.allergens,
        tags: input.tags,
        quantityTotal: input.quantityTotal,
        quantityAvailable: input.quantityTotal,
        unit: input.unit,
        weightKgPerUnit: input.weightKgPerUnit,
        priceCents: input.mode === "SALE" ? input.priceCents : 0,
        originalPriceCents: input.originalPriceCents ?? null,
        currency: env.currency,
        storage: input.storage,
        preparedAt: input.preparedAt ?? null,
        expiresAt: input.expiresAt,
        pickupStart: input.pickupStart,
        pickupEnd: input.pickupEnd,
        address,
        city: city ?? null,
        lat,
        lng,
        pickupInstructions: input.pickupInstructions,
        photoKeys: input.photoKeys.filter((k) => k.startsWith(`public/listing/${user.id}/`)),
        audience: input.audience,
        ngoPriorityUntil: input.ngoPriorityMinutes > 0 ? new Date(now.getTime() + input.ngoPriorityMinutes * 60_000) : null,
        requiresApproval: input.requiresApproval,
        allowsDelivery: input.allowsDelivery,
        maxPerClaim: input.maxPerClaim ?? null,
        safetyAck: input.safetyAck,
        publishedAt: now,
      },
    });
    await enqueue("alerts.match", { listingId: created.id }, { tx });
    await audit(user.id, "listing.created", "Listing", created.id, { mode: created.mode }, tx);
    return created;
  });
  return listing;
}

const SAFE_WHILE_CLAIMED = new Set(["description", "pickupInstructions", "pickupEnd", "quantityTotal"]);

export async function updateListing(user: CurrentUser, id: string, patch: Partial<ListingInput>) {
  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) throw notFound("Listing");
  if (listing.ownerId !== user.id) throw forbidden();
  if (!["ACTIVE", "RESERVED", "DRAFT"].includes(listing.status)) throw conflict("This listing can no longer be edited");

  const activeClaims = await db.claim.count({ where: { listingId: id, status: { in: ACTIVE_CLAIM_STATUSES } } });
  const keys = Object.keys(patch).filter((k) => patch[k as keyof ListingInput] !== undefined);
  if (activeClaims > 0) {
    const blocked = keys.filter((k) => !SAFE_WHILE_CLAIMED.has(k));
    if (blocked.length) throw conflict(`People have reserved this food — you can only update the description, instructions, quantity or extend pickup (not ${blocked.join(", ")})`);
    if (patch.pickupEnd && patch.pickupEnd < listing.pickupEnd) throw conflict("You can only extend the pickup window while claims are active");
  }

  const reserved = listing.quantityTotal - listing.quantityAvailable;
  const nextTotal = patch.quantityTotal ?? listing.quantityTotal;
  if (nextTotal < reserved) throw conflict(`${reserved} ${listing.unit} are already reserved`);

  const merged = { ...listing, ...stripUndefined(patch) };
  const violations = listingViolations(
    {
      ...merged,
      preparedAt: merged.preparedAt ?? null,
      originalPriceCents: merged.originalPriceCents ?? null,
    },
    new Date(),
  );
  if (violations.length) throw badRequest(violations[0], { violations });

  return db.$transaction(async (tx) => {
    const { ngoPriorityMinutes: _ignored, locationId: _loc, ...rest } = stripUndefined(patch);
    const updated = await tx.listing.update({
      where: { id },
      data: {
        ...rest,
        quantityTotal: nextTotal,
        quantityAvailable: nextTotal - reserved,
        priceCents: merged.mode === "SALE" ? merged.priceCents : 0,
      },
    });
    await syncListingStatus(tx, id);
    await audit(user.id, "listing.updated", "Listing", id, { fields: keys }, tx);
    return updated;
  });
}

/** Donor (or moderator) withdraws a listing: every open claim is cancelled and refunded. */
export async function cancelListing(actor: CurrentUser, id: string, reason: string, opts: { removed?: boolean } = {}) {
  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) throw notFound("Listing");
  if (listing.ownerId !== actor.id && !isStaff(actor)) throw forbidden();
  if (["CANCELLED", "REMOVED", "COMPLETED", "EXPIRED"].includes(listing.status)) return listing;

  const open = await db.claim.findMany({ where: { listingId: id, status: { in: ACTIVE_CLAIM_STATUSES } }, select: { id: true } });
  for (const c of open) await cancelClaim(actor, c.id, reason, { force: true });

  const updated = await db.listing.update({ where: { id }, data: { status: opts.removed ? "REMOVED" : "CANCELLED" } });
  await audit(actor.id, opts.removed ? "listing.removed" : "listing.cancelled", "Listing", id, { reason });
  return updated;
}

// ─── Discovery ─────────────────────────────────────────────────────────

export type SearchParams = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  q?: string;
  category?: string;
  diet?: string;
  mode?: string;
  excludeAllergens: string[];
  limit: number;
  offset: number;
};

export async function searchListings(viewer: Viewer, p: SearchParams) {
  const lat = p.lat ?? viewer?.lat ?? env.defaultLat;
  const lng = p.lng ?? viewer?.lng ?? env.defaultLng;
  const radius = Math.min(p.radiusKm ?? PLATFORM.defaultRadiusKm, PLATFORM.maxRadiusKm);
  const box = boundingBox(lat, lng, radius);
  const ngo = viewer?.organization?.kind === "NGO" && viewer.organization.verificationStatus === "VERIFIED";

  const distance = Prisma.sql`(6371 * 2 * asin(sqrt(
      power(sin(radians(l.lat - ${lat}) / 2), 2) +
      cos(radians(${lat})) * cos(radians(l.lat)) * power(sin(radians(l.lng - ${lng}) / 2), 2))))`;

  const filters: Prisma.Sql[] = [
    Prisma.sql`l.status = 'ACTIVE'`,
    Prisma.sql`l."pickupEnd" > now()`,
    Prisma.sql`l."expiresAt" > now()`,
    Prisma.sql`l.lat BETWEEN ${box.minLat} AND ${box.maxLat}`,
    Prisma.sql`l.lng BETWEEN ${box.minLng} AND ${box.maxLng}`,
  ];
  if (!ngo) filters.push(Prisma.sql`l.audience = 'EVERYONE'`);
  if (p.category) filters.push(Prisma.sql`l.category = ${p.category}::"FoodCategory"`);
  if (p.diet) {
    // Vegans can eat vegan; vegetarians can eat vegan + vegetarian, etc.
    const compatible: Record<string, string[]> = {
      VEGAN: ["VEGAN"],
      VEGETARIAN: ["VEGAN", "VEGETARIAN"],
      EGGETARIAN: ["VEGAN", "VEGETARIAN", "EGGETARIAN"],
      NON_VEGETARIAN: ["VEGAN", "VEGETARIAN", "EGGETARIAN", "NON_VEGETARIAN"],
    };
    filters.push(Prisma.sql`l."dietType"::text IN (${Prisma.join(compatible[p.diet] ?? [p.diet])})`);
  }
  if (p.mode) filters.push(Prisma.sql`l.mode = ${p.mode}::"ListingMode"`);
  if (p.excludeAllergens.length) filters.push(Prisma.sql`NOT (l.allergens && ${p.excludeAllergens}::text[])`);
  if (p.q) filters.push(Prisma.sql`(l.title ILIKE ${"%" + p.q + "%"} OR l.description ILIKE ${"%" + p.q + "%"})`);
  if (viewer) filters.push(Prisma.sql`l."ownerId" <> ${viewer.id}`);

  const rows = await db.$queryRaw<{ id: string; distance_km: number }[]>`
    SELECT l.id, ${distance} AS distance_km
    FROM "Listing" l
    WHERE ${Prisma.join(filters, " AND ")} AND ${distance} <= ${radius}
    ORDER BY distance_km ASC, l."pickupEnd" ASC
    LIMIT ${p.limit} OFFSET ${p.offset}`;

  const listings = await db.listing.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: listingInclude });
  const byId = new Map(listings.map((l) => [l.id, l]));
  return {
    center: { lat, lng, radiusKm: radius },
    items: rows.flatMap((r) => {
      const l = byId.get(r.id);
      return l ? [toListingView(l, viewer, { exact: Boolean(l.organizationId), distanceKm: Number(r.distance_km) })] : [];
    }),
  };
}

export const listingInclude = {
  organization: { select: { id: true, name: true, kind: true, verificationStatus: true, plan: true } },
  owner: { select: { id: true, name: true, ratingAvg: true, ratingCount: true, completedCount: true } },
} satisfies Prisma.ListingInclude;

type ListingWithOwner = Listing & {
  organization: Pick<Organization, "id" | "name" | "kind" | "verificationStatus" | "plan"> | null;
  owner: { id: string; name: string; ratingAvg: number; ratingCount: number; completedCount: number };
};

export async function getListingForViewer(id: string, viewer: Viewer) {
  const listing = await db.listing.findUnique({ where: { id }, include: listingInclude });
  if (!listing) return null;
  const isOwner = viewer?.id === listing.ownerId;
  if (listing.status === "REMOVED" && !isOwner && !(viewer && isStaff(viewer))) return null;
  if (listing.audience === "VERIFIED_NGO_ONLY" && !isOwner && !(viewer && isStaff(viewer))) {
    const ngo = viewer?.organization?.kind === "NGO" && viewer.organization.verificationStatus === "VERIFIED";
    if (!ngo) return null;
  }

  const myClaim = viewer
    ? await db.claim.findFirst({ where: { listingId: id, claimantId: viewer.id }, orderBy: { createdAt: "desc" } })
    : null;
  const exact =
    isOwner ||
    Boolean(listing.organizationId) ||
    (viewer != null && isStaff(viewer)) ||
    Boolean(myClaim && ["CONFIRMED", "IN_DELIVERY", "COMPLETED"].includes(myClaim.status));

  if (!isOwner) await db.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  return { listing: toListingView(listing, viewer, { exact }), myClaim, raw: listing };
}

export function toListingView(l: ListingWithOwner, viewer: Viewer, opts: { exact: boolean; distanceKm?: number }) {
  const p = PLATFORM.publicLocationPrecision;
  const firstName = l.owner.name.split(" ")[0];
  return {
    id: l.id,
    mode: l.mode,
    status: l.status,
    title: l.title,
    description: l.description,
    category: l.category,
    dietType: l.dietType,
    allergens: l.allergens,
    tags: l.tags,
    quantityTotal: l.quantityTotal,
    quantityAvailable: l.quantityAvailable,
    unit: l.unit,
    weightKgPerUnit: l.weightKgPerUnit,
    priceCents: l.priceCents,
    originalPriceCents: l.originalPriceCents,
    discountPercent: discountPercent(l.priceCents, l.originalPriceCents),
    currency: l.currency,
    storage: l.storage,
    preparedAt: l.preparedAt,
    expiresAt: l.expiresAt,
    pickupStart: l.pickupStart,
    pickupEnd: l.pickupEnd,
    city: l.city,
    lat: opts.exact ? l.lat : fuzz(l.lat, p),
    lng: opts.exact ? l.lng : fuzz(l.lng, p),
    exactLocation: opts.exact,
    address: opts.exact ? l.address : null,
    pickupInstructions: opts.exact ? l.pickupInstructions : null,
    photos: l.photoKeys.map(publicFileUrl),
    audience: l.audience,
    ngoPriorityUntil: l.ngoPriorityUntil,
    requiresApproval: l.requiresApproval,
    allowsDelivery: l.allowsDelivery,
    maxPerClaim: l.maxPerClaim,
    distanceKm: opts.distanceKm != null ? Math.round(opts.distanceKm * 10) / 10 : null,
    createdAt: l.createdAt,
    isOwner: viewer?.id === l.ownerId,
    donor: {
      id: l.owner.id,
      name: l.organization?.name ?? firstName,
      kind: l.organization?.kind ?? "INDIVIDUAL",
      verified: l.organization?.verificationStatus === "VERIFIED",
      pro: l.organization?.plan === "PRO" || l.organization?.plan === "ENTERPRISE",
      ratingAvg: l.owner.ratingAvg,
      ratingCount: l.owner.ratingCount,
      completedCount: l.owner.completedCount,
    },
  };
}
export type ListingView = ReturnType<typeof toListingView>;

function stripUndefined<T extends object>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
