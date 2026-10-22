import type { Claim, Listing } from "@prisma/client";
import { db, type Tx } from "../db";
import { PLATFORM } from "../config";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { handoverCode } from "../crypto";
import { haversineKm } from "../geo";
import { ACTIVE_CLAIM_STATUSES, assertClaimTransition, releasesQuantity } from "../domain/claim-state";
import { applyNoShowStrike, claimBlocker } from "../domain/fairness";
import { buyerRefundEligible } from "../domain/pricing";
import { impactFor } from "../domain/impact";
import { isStaff } from "../auth/guards";
import type { CurrentUser } from "../auth/session";
import { notify } from "./notifications";
import { audit } from "./audit";
import { onClaimConfirmed, syncListingStatus } from "./claim-effects";
import { createListingOrder, payStipend, refundOrder, settleClaim, startCheckout } from "./billing";

type ClaimInput = {
  quantity: number;
  fulfilment: "SELF_PICKUP" | "VOLUNTEER_DELIVERY";
  note: string | null;
  dropAddress?: string | null;
  dropLat?: number | null;
  dropLng?: number | null;
  tipCents: number;
};

export async function createClaim(user: CurrentUser, listingId: string, input: ClaimInput) {
  const listing = await db.listing.findUnique({ where: { id: listingId }, include: { organization: true } });
  if (!listing) throw notFound("Listing");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [activeClaims, claimsToday] = await Promise.all([
    db.claim.count({ where: { claimantId: user.id, status: { in: ACTIVE_CLAIM_STATUSES } } }),
    db.claim.count({ where: { claimantId: user.id, createdAt: { gte: startOfDay } } }),
  ]);
  const blocker = claimBlocker(
    {
      id: user.id,
      accountType: user.accountType,
      status: user.status,
      suspendedUntil: user.suspendedUntil,
      emailVerified: Boolean(user.emailVerifiedAt),
      orgKind: user.organization?.kind ?? null,
      orgVerification: user.organization?.verificationStatus ?? null,
      activeClaims,
      claimsToday,
    },
    listing,
    input.quantity,
  );
  if (blocker) throw conflict(blocker);

  if (input.fulfilment === "VOLUNTEER_DELIVERY") {
    if (!listing.allowsDelivery) throw badRequest("This donor only offers self-pickup");
    if (input.dropLat == null || input.dropLng == null || !input.dropAddress) throw badRequest("Add a delivery address");
    const km = haversineKm(listing.lat, listing.lng, input.dropLat, input.dropLng);
    if (km > PLATFORM.maxDeliveryKm) throw badRequest(`Volunteer delivery is limited to ${PLATFORM.maxDeliveryKm} km`);
  }

  const now = new Date();
  const isSale = listing.mode === "SALE";
  const status = isSale ? "PENDING_PAYMENT" : listing.requiresApproval ? "PENDING_APPROVAL" : "CONFIRMED";
  const holdMinutes = isSale ? PLATFORM.paymentHoldMinutes : PLATFORM.approvalHoldMinutes;
  const holdExpiresAt =
    status === "CONFIRMED" ? null : new Date(Math.min(now.getTime() + holdMinutes * 60_000, listing.pickupEnd.getTime()));

  const { claim, order } = await db.$transaction(async (tx) => {
    // Atomic stock check-and-decrement: two people can't get the last portion.
    const reserved = await tx.listing.updateMany({
      where: { id: listingId, status: "ACTIVE", quantityAvailable: { gte: input.quantity } },
      data: { quantityAvailable: { decrement: input.quantity } },
    });
    if (reserved.count === 0) throw conflict("Someone just reserved this — try a smaller quantity or another listing");

    const claim = await tx.claim.create({
      data: {
        listingId,
        claimantId: user.id,
        quantity: input.quantity,
        status,
        fulfilment: input.fulfilment,
        note: input.note,
        pickupCode: handoverCode(),
        dropAddress: input.dropAddress ?? null,
        dropLat: input.dropLat ?? null,
        dropLng: input.dropLng ?? null,
        holdExpiresAt,
        confirmedAt: status === "CONFIRMED" ? now : null,
      },
    });

    let order = null;
    if (isSale) {
      order = await createListingOrder(tx, {
        claimId: claim.id,
        buyerId: user.id,
        unitPriceCents: listing.priceCents,
        quantity: input.quantity,
        sellerPlan: listing.organization?.plan ?? "FREE",
        tipCents: input.tipCents,
        currency: listing.currency,
      });
      await syncListingStatus(tx, listingId);
    } else if (status === "CONFIRMED") {
      await onClaimConfirmed(tx, claim.id);
    } else {
      await syncListingStatus(tx, listingId);
      await notify(listing.ownerId, {
        type: "claim.approval",
        title: `Approve request for ${listing.title}?`,
        body: `${user.name} asked for ${input.quantity} ${listing.unit}. Respond within ${PLATFORM.approvalHoldMinutes} minutes.`,
        link: `/dashboard/claims/${claim.id}`,
        email: "now",
      }, tx);
    }
    await audit(user.id, "claim.created", "Claim", claim.id, { listingId, quantity: input.quantity, status }, tx);
    return { claim, order };
  });

  if (order) {
    try {
      const checkout = await startCheckout(order, user.email, `${input.quantity} × ${listing.title}`, `/dashboard/claims/${claim.id}`);
      return { claim, checkout };
    } catch (err) {
      // Provider down: release the stock immediately rather than holding it for 15 minutes.
      await expireClaim(claim.id, "Payment could not be started");
      throw err;
    }
  }
  return { claim, checkout: null };
}

async function loadClaim(claimId: string) {
  const claim = await db.claim.findUnique({ where: { id: claimId }, include: { listing: true, delivery: true, order: true } });
  if (!claim) throw notFound("Claim");
  return claim;
}

export async function decideApproval(user: CurrentUser, claimId: string, approve: boolean, reason?: string) {
  const claim = await loadClaim(claimId);
  if (claim.listing.ownerId !== user.id) throw forbidden();
  const to = approve ? "CONFIRMED" : "REJECTED";
  assertClaimTransition(claim.status, to);

  await db.$transaction(async (tx) => {
    await moveClaim(tx, claim, to, { holdExpiresAt: null, cancelReason: approve ? null : reason ?? null, confirmedAt: approve ? new Date() : null });
    if (approve) await onClaimConfirmed(tx, claim.id);
    else
      await notify(claim.claimantId, {
        type: "claim.rejected",
        title: "Request declined",
        body: `The donor couldn't accept your request for ${claim.listing.title}${reason ? `: ${reason}` : "."}`,
        link: "/browse",
        email: "now",
      }, tx);
    await audit(user.id, approve ? "claim.approved" : "claim.rejected", "Claim", claim.id, { reason }, tx);
  });
}

/**
 * Cancel by claimant, donor or staff. Paid orders: donor/staff cancellation is
 * always refunded; a buyer cancelling close to the deadline forfeits the payment.
 */
export async function cancelClaim(actor: CurrentUser, claimId: string, reason: string, opts: { force?: boolean } = {}) {
  const claim = await loadClaim(claimId);
  const isClaimant = actor.id === claim.claimantId;
  const isDonor = actor.id === claim.listing.ownerId;
  if (!isClaimant && !isDonor && !isStaff(actor)) throw forbidden();
  if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) {
    if (opts.force) return;
    throw conflict("This claim is already closed");
  }
  if (claim.status === "IN_DELIVERY" && isClaimant && !opts.force) throw conflict("A volunteer is already on the way — message them instead");

  await db.$transaction(async (tx) => {
    await moveClaim(tx, claim, "CANCELLED", { cancelledAt: new Date(), cancelledById: actor.id, cancelReason: reason });
    if (claim.delivery && claim.delivery.status !== "DELIVERED") {
      await tx.deliveryTask.update({ where: { id: claim.delivery.id }, data: { status: "CANCELLED" } });
      if (claim.delivery.volunteerId)
        await notify(claim.delivery.volunteerId, { type: "delivery.cancelled", title: "Delivery cancelled", body: `${claim.listing.title} no longer needs delivery. Thank you!`, link: "/dashboard/deliveries" }, tx);
    }
    const other = isClaimant ? claim.listing.ownerId : claim.claimantId;
    await notify(other, {
      type: "claim.cancelled",
      title: "Reservation cancelled",
      body: `${claim.quantity} ${claim.listing.unit} of ${claim.listing.title} — ${reason}`,
      link: `/dashboard/claims/${claim.id}`,
      email: "now",
    }, tx);
    await audit(actor.id, "claim.cancelled", "Claim", claim.id, { reason }, tx);
  });

  if (claim.order?.status === "PAID") {
    const refund = !isClaimant || buyerRefundEligible(claim.listing.pickupEnd);
    if (refund) await refundOrder(claim.order.id, reason);
    else await db.$transaction((tx) => settleClaim(tx, claim.id)); // late buyer cancellation: seller keeps the sale
  }
}

/** Donor types the handover code shown by the claimant (self-pickup) or volunteer. */
export async function verifyHandover(user: CurrentUser, claimId: string, code: string) {
  const claim = await loadClaim(claimId);
  if (claim.listing.ownerId !== user.id) throw forbidden("Only the donor can confirm the handover");
  if (claim.status !== "CONFIRMED") throw conflict("This reservation is not awaiting pickup");
  if (claim.fulfilment === "VOLUNTEER_DELIVERY" && claim.delivery?.status !== "ACCEPTED")
    throw conflict("No volunteer has accepted this delivery yet");
  await checkCode(claim.id, claim.codeAttempts, claim.pickupCode, code);

  await db.$transaction(async (tx) => {
    if (claim.fulfilment === "VOLUNTEER_DELIVERY") {
      await moveClaim(tx, claim, "IN_DELIVERY");
      await tx.deliveryTask.update({ where: { id: claim.delivery!.id }, data: { status: "PICKED_UP", pickedUpAt: new Date() } });
      await notify(claim.claimantId, { type: "delivery.picked_up", title: "Your food is on the way", body: `A volunteer collected ${claim.listing.title}. Share your drop code when they arrive.`, link: `/dashboard/claims/${claim.id}`, email: "never" }, tx);
    } else {
      await completeClaim(tx, claim);
    }
    await audit(user.id, "claim.handover", "Claim", claim.id, {}, tx);
  });
}

async function checkCode(claimId: string, attempts: number, expected: string, given: string) {
  if (attempts >= PLATFORM.maxCodeAttempts) throw conflict("Too many wrong codes — use the chat or contact support");
  if (given.trim() !== expected) {
    await db.claim.update({ where: { id: claimId }, data: { codeAttempts: { increment: 1 } } });
    throw badRequest(`Incorrect code (${PLATFORM.maxCodeAttempts - attempts - 1} attempts left)`);
  }
}

// ─── Volunteer delivery ────────────────────────────────────────────────

export async function acceptDelivery(user: CurrentUser, taskId: string) {
  if (!user.isVolunteer) throw forbidden("Turn on volunteering in your settings first");
  if (!user.emailVerifiedAt || user.status !== "ACTIVE") throw forbidden("Your account can't take deliveries right now");
  const task = await db.deliveryTask.findUnique({ where: { id: taskId }, include: { claim: { include: { listing: true } } } });
  if (!task) throw notFound("Delivery");
  if ([task.claim.claimantId, task.claim.listing.ownerId].includes(user.id)) throw conflict("You can't deliver your own food");
  const mine = await db.deliveryTask.count({ where: { volunteerId: user.id, status: { in: ["ACCEPTED", "PICKED_UP"] } } });
  if (mine >= 3) throw conflict("Finish your current deliveries first (max 3 at once)");

  await db.$transaction(async (tx) => {
    const taken = await tx.deliveryTask.updateMany({
      where: { id: taskId, status: "OPEN" },
      data: { status: "ACCEPTED", volunteerId: user.id, acceptedAt: new Date() },
    });
    if (taken.count === 0) throw conflict("Another volunteer already took this delivery");
    const msg = { type: "delivery.accepted", title: "Volunteer assigned", body: `${user.name.split(" ")[0]} will deliver ${task.claim.listing.title}.`, link: `/dashboard/claims/${task.claimId}`, email: "never" as const };
    await notify(task.claim.claimantId, msg, tx);
    await notify(task.claim.listing.ownerId, msg, tx);
    await audit(user.id, "delivery.accepted", "DeliveryTask", taskId, {}, tx);
  });
}

export async function releaseDelivery(user: CurrentUser, taskId: string) {
  const task = await db.deliveryTask.findUnique({ where: { id: taskId }, include: { claim: { include: { listing: true } } } });
  if (!task || task.volunteerId !== user.id) throw notFound("Delivery");
  if (task.status !== "ACCEPTED") throw conflict("You've already collected this — please complete the delivery");
  await db.$transaction(async (tx) => {
    await tx.deliveryTask.update({ where: { id: taskId }, data: { status: "OPEN", volunteerId: null, acceptedAt: null } });
    await notify(task.claim.claimantId, { type: "delivery.released", title: "Looking for another volunteer", body: `Your volunteer had to drop out. We've reopened the delivery for ${task.claim.listing.title}.`, link: `/dashboard/claims/${task.claimId}` }, tx);
    await audit(user.id, "delivery.released", "DeliveryTask", taskId, {}, tx);
  });
}

/** Volunteer types the recipient's drop code on arrival. */
export async function confirmDrop(user: CurrentUser, taskId: string, code: string) {
  const task = await db.deliveryTask.findUnique({ where: { id: taskId } });
  if (!task || task.volunteerId !== user.id) throw notFound("Delivery");
  if (task.status !== "PICKED_UP") throw conflict("Collect the food from the donor first");
  const claim = await loadClaim(task.claimId);
  await checkCode(claim.id, claim.codeAttempts, task.dropCode, code);

  await db.$transaction(async (tx) => {
    await tx.deliveryTask.update({ where: { id: taskId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await completeClaim(tx, claim);
    const stipend = await payStipend(tx, taskId, user.id, task.distanceKm);
    await notify(user.id, {
      type: "delivery.done",
      title: "Delivery complete — thank you!",
      body: stipend > 0 ? "A stipend from our sponsors' Rescue Fund was added to your balance." : "Your rescue has been counted in your impact.",
      link: "/dashboard/impact",
      email: "never",
    }, tx);
    await tx.user.update({ where: { id: user.id }, data: { completedCount: { increment: 1 } } });
    await audit(user.id, "delivery.delivered", "DeliveryTask", taskId, { stipend }, tx);
  });
}

// ─── Internal transitions (also used by the sweep job) ───────────────

async function completeClaim(tx: Tx, claim: Claim & { listing: Listing }) {
  const impact = impactFor(claim.quantity, claim.listing.weightKgPerUnit);
  await moveClaim(tx, claim, "COMPLETED", { completedAt: new Date(), kgSaved: impact.kgSaved, meals: impact.meals, co2eKg: impact.co2eKg });
  await tx.user.update({ where: { id: claim.claimantId }, data: { completedCount: { increment: 1 } } });
  await tx.user.update({ where: { id: claim.listing.ownerId }, data: { completedCount: { increment: 1 } } });
  await settleClaim(tx, claim.id);
  const review = { type: "claim.completed", title: "Rescue complete 🎉", body: `${impact.kgSaved} kg of food saved (${impact.meals} meals). Leave a quick review?`, link: `/dashboard/claims/${claim.id}`, email: "never" as const };
  await notify(claim.claimantId, review, tx);
  await notify(claim.listing.ownerId, review, tx);
}

export async function expireClaim(claimId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const claim = await tx.claim.findUniqueOrThrow({ where: { id: claimId }, include: { listing: true } });
    if (!ACTIVE_CLAIM_STATUSES.includes(claim.status) || claim.status === "IN_DELIVERY") return;
    await moveClaim(tx, claim, "EXPIRED", { cancelReason: reason });
    await tx.deliveryTask.updateMany({ where: { claimId, status: { in: ["OPEN", "ACCEPTED"] } }, data: { status: "CANCELLED" } });
    await notify(claim.claimantId, { type: "claim.expired", title: "Reservation expired", body: `${claim.listing.title}: ${reason}`, link: "/browse", email: "never" }, tx);
  });
}

export async function markNoShow(claimId: string) {
  await db.$transaction(async (tx) => {
    const claim = await tx.claim.findUniqueOrThrow({ where: { id: claimId }, include: { listing: true, claimant: true } });
    if (claim.status !== "CONFIRMED") return;
    await moveClaim(tx, claim, "NO_SHOW");
    const strike = applyNoShowStrike(claim.claimant.noShowStrikes);
    await tx.user.update({
      where: { id: claim.claimantId },
      data: { noShowStrikes: strike.strikes, ...(strike.suspendedUntil ? { status: "SUSPENDED", suspendedUntil: strike.suspendedUntil } : {}) },
    });
    await tx.deliveryTask.updateMany({ where: { claimId, status: { in: ["OPEN", "ACCEPTED"] } }, data: { status: "CANCELLED" } });
    await settleClaim(tx, claim.id); // paid no-show: seller still gets paid
    await notify(claim.claimantId, {
      type: "claim.no_show",
      title: "Missed pickup",
      body: strike.suspendedUntil
        ? `You missed ${PLATFORM.noShowStrikeLimit} pickups, so claiming is paused until ${strike.suspendedUntil.toDateString()}.`
        : `You missed the pickup for ${claim.listing.title}. ${PLATFORM.noShowStrikeLimit - strike.strikes} more and claiming will be paused.`,
      link: "/dashboard/claims",
      email: "now",
    }, tx);
    await notify(claim.listing.ownerId, { type: "claim.no_show", title: "Pickup missed", body: `The reservation for ${claim.listing.title} was not collected.`, link: `/dashboard/claims/${claim.id}` }, tx);
  });
}

/** The one place a claim's status changes; returns stock to the listing when needed. */
async function moveClaim(tx: Tx, claim: Claim, to: Claim["status"], data: Partial<Claim> = {}) {
  assertClaimTransition(claim.status, to);
  const moved = await tx.claim.updateMany({ where: { id: claim.id, status: claim.status }, data: { ...data, status: to } });
  if (moved.count === 0) throw conflict("This reservation changed in the meantime — refresh and try again");
  if (releasesQuantity(claim.status, to)) {
    await tx.listing.update({ where: { id: claim.listingId }, data: { quantityAvailable: { increment: claim.quantity } } });
  }
  await syncListingStatus(tx, claim.listingId);
}

// ─── Reads ─────────────────────────────────────────────────────────────

export async function getClaimForViewer(user: CurrentUser, claimId: string) {
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      listing: { include: { owner: { select: { id: true, name: true, phone: true } }, organization: { select: { name: true, phone: true } } } },
      claimant: { select: { id: true, name: true, phone: true, ratingAvg: true, ratingCount: true, noShowStrikes: true, completedCount: true } },
      delivery: { include: { volunteer: { select: { id: true, name: true, phone: true } } } },
      order: true,
      reviews: true,
    },
  });
  if (!claim) return null;
  const role =
    claim.claimantId === user.id ? "claimant" : claim.listing.ownerId === user.id ? "donor" : claim.delivery?.volunteerId === user.id ? "volunteer" : isStaff(user) ? "staff" : null;
  if (!role) return null;

  // Phones are only revealed between confirmed parties; codes only to whoever must show them.
  const revealed = ["CONFIRMED", "IN_DELIVERY"].includes(claim.status);
  const showPickupCode = (role === "claimant" && claim.fulfilment === "SELF_PICKUP") || role === "volunteer";
  const showDropCode = role === "claimant" && claim.fulfilment === "VOLUNTEER_DELIVERY";
  return {
    role,
    claim: {
      ...claim,
      pickupCode: showPickupCode && revealed ? claim.pickupCode : null,
      delivery: claim.delivery
        ? { ...claim.delivery, dropCode: showDropCode && revealed ? claim.delivery.dropCode : null, volunteer: claim.delivery.volunteer ? { ...claim.delivery.volunteer, phone: revealed ? claim.delivery.volunteer.phone : null } : null }
        : null,
      claimant: { ...claim.claimant, phone: revealed && role !== "claimant" ? claim.claimant.phone : null },
      listing: {
        ...claim.listing,
        owner: { ...claim.listing.owner, phone: revealed ? claim.listing.organization?.phone ?? claim.listing.owner.phone : null },
      },
    },
  };
}
