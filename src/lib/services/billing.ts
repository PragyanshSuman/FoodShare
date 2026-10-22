import type { Order, Plan } from "@prisma/client";
import { db, type Tx } from "../db";
import { env } from "../env";
import { PLAN_PRICES, PLATFORM } from "../config";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { getPaymentProvider } from "../payments";
import { extendPlan, saleBreakdown, sponsorshipBreakdown, volunteerStipendCents } from "../domain/pricing";
import { formatMoney } from "../money";
import { notify } from "./notifications";
import { audit } from "./audit";
import { onClaimConfirmed } from "./claim-effects";
import type { CurrentUser } from "../auth/session";

export const ACCOUNTS = {
  user: (id: string) => `user:${id}`,
  fund: "fund:rescue",
  platform: "platform:revenue",
};

export async function balanceOf(account: string, tx?: Tx) {
  const agg = await (tx ?? db).ledgerEntry.aggregate({ where: { account }, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0;
}

/** Serialise concurrent writers to one ledger account for the rest of the transaction. */
async function lockAccount(tx: Tx, account: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${account}))`;
}

// ─── Checkout ──────────────────────────────────────────────────────────

export async function startCheckout(order: Order, buyerEmail: string, description: string, returnPath: string) {
  const provider = getPaymentProvider();
  const result = await provider.createCheckout({
    orderId: order.id,
    amountCents: order.amountCents,
    currency: order.currency,
    description,
    customerEmail: buyerEmail,
    successUrl: `${env.appUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}paid=1`,
    cancelUrl: `${env.appUrl}${returnPath}`,
  });
  await db.order.update({ where: { id: order.id }, data: { providerOrderId: result.providerOrderId, provider: provider.name } });
  return { orderId: order.id, provider: provider.name, redirectUrl: result.redirectUrl, clientPayload: result.clientPayload };
}

export async function createListingOrder(
  tx: Tx,
  args: { claimId: string; buyerId: string; unitPriceCents: number; quantity: number; sellerPlan: Plan; tipCents: number; currency: string },
) {
  const b = saleBreakdown(args.unitPriceCents, args.quantity, args.sellerPlan, args.tipCents);
  return tx.order.create({
    data: {
      userId: args.buyerId,
      kind: "LISTING_PURCHASE",
      provider: env.paymentProvider,
      amountCents: b.totalCents,
      currency: args.currency,
      platformFeeCents: b.platformFeeCents,
      tipCents: b.tipCents,
      payeeAmountCents: b.payeeAmountCents,
      claimId: args.claimId,
    },
  });
}

export async function createSubscriptionOrder(user: CurrentUser, period: "monthly" | "yearly") {
  if (!user.organization || user.organization.kind !== "BUSINESS") throw forbidden("Pro plans are for food businesses");
  const prices = PLAN_PRICES[env.currency] ?? PLAN_PRICES.USD;
  const amountCents = period === "monthly" ? prices.monthly : prices.yearly;
  const order = await db.order.create({
    data: {
      userId: user.id,
      kind: "SUBSCRIPTION",
      provider: env.paymentProvider,
      amountCents,
      currency: env.currency,
      platformFeeCents: amountCents,
      organizationId: user.organization.id,
      plan: "PRO",
      periodMonths: period === "monthly" ? 1 : 12,
    },
  });
  return startCheckout(order, user.email, `FoodShare Pro (${period})`, "/dashboard/billing");
}

export async function createSponsorshipOrder(
  user: CurrentUser,
  input: { amountCents: number; displayName: string; message?: string | null; website?: string | null },
) {
  if (input.amountCents < PLATFORM.sponsorCostPerDeliveryCents) throw badRequest("Minimum sponsorship covers one delivery");
  const { deliveriesFunded, feeCents } = sponsorshipBreakdown(input.amountCents);
  const order = await db.$transaction(async (tx) => {
    const sponsorship = await tx.sponsorship.create({
      data: {
        sponsorId: user.id,
        displayName: input.displayName,
        message: input.message ?? null,
        website: input.website ?? null,
        amountCents: input.amountCents,
        currency: env.currency,
        deliveriesFunded,
      },
    });
    return tx.order.create({
      data: {
        userId: user.id,
        kind: "SPONSORSHIP",
        provider: env.paymentProvider,
        amountCents: input.amountCents,
        currency: env.currency,
        platformFeeCents: feeCents,
        sponsorshipId: sponsorship.id,
      },
    });
  });
  return startCheckout(order, user.email, `Rescue Fund sponsorship — ${deliveriesFunded} deliveries`, "/sponsor");
}

export async function createTipOrder(user: CurrentUser, amountCents: number) {
  if (amountCents < 100) throw badRequest("Minimum contribution is 1.00");
  const order = await db.order.create({
    data: {
      userId: user.id,
      kind: "PLATFORM_TIP",
      provider: env.paymentProvider,
      amountCents,
      currency: env.currency,
      platformFeeCents: amountCents,
    },
  });
  return startCheckout(order, user.email, "Support FoodShare", "/dashboard");
}

// ─── Payment outcomes (idempotent: webhooks may arrive twice or late) ─

export async function markOrderPaid(ref: { orderId?: string; providerOrderId?: string }, providerPaymentId?: string) {
  let refundReason: string | null = null;

  const order = await db.$transaction(async (tx) => {
    const found = await tx.order.findFirst({
      where: ref.orderId ? { id: ref.orderId } : { providerOrderId: ref.providerOrderId },
    });
    if (!found) throw notFound("Order");
    const flipped = await tx.order.updateMany({
      where: { id: found.id, status: { in: ["CREATED", "FAILED", "EXPIRED"] } },
      data: { status: "PAID", paidAt: new Date(), providerPaymentId: providerPaymentId ?? found.providerPaymentId },
    });
    if (flipped.count === 0) return null; // already processed

    switch (found.kind) {
      case "LISTING_PURCHASE": {
        const claim = await tx.claim.findUniqueOrThrow({ where: { id: found.claimId! } });
        if (claim.status === "PENDING_PAYMENT") {
          await tx.claim.update({ where: { id: claim.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), holdExpiresAt: null } });
          await onClaimConfirmed(tx, claim.id);
        } else if (claim.status === "EXPIRED") {
          // Payment landed after the hold lapsed: re-reserve if stock is still there.
          const reserved = await tx.listing.updateMany({
            where: { id: claim.listingId, status: "ACTIVE", quantityAvailable: { gte: claim.quantity } },
            data: { quantityAvailable: { decrement: claim.quantity } },
          });
          if (reserved.count === 1) {
            await tx.claim.update({ where: { id: claim.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), holdExpiresAt: null } });
            await onClaimConfirmed(tx, claim.id);
          } else {
            refundReason = "The item sold out before your payment completed";
          }
        } else {
          refundReason = "This reservation was cancelled before payment completed";
        }
        break;
      }
      case "SUBSCRIPTION": {
        const org = await tx.organization.findUniqueOrThrow({ where: { id: found.organizationId! } });
        await tx.organization.update({
          where: { id: org.id },
          data: { plan: found.plan!, planRenewsAt: extendPlan(org.planRenewsAt, found.periodMonths ?? 1), planReminderSentAt: null },
        });
        await ledger(tx, ACCOUNTS.platform, found.amountCents, "SUBSCRIPTION", found.id);
        await notify(found.userId, { type: "billing", title: "FoodShare Pro is active", body: `Thanks! ${org.name} now has Pro features.`, link: "/dashboard/billing", email: "now" }, tx);
        break;
      }
      case "SPONSORSHIP": {
        await tx.sponsorship.update({ where: { id: found.sponsorshipId! }, data: { status: "ACTIVE" } });
        const { feeCents, fundCents } = sponsorshipBreakdown(found.amountCents);
        await ledger(tx, ACCOUNTS.fund, fundCents, "SPONSOR_FUND", found.id);
        await ledger(tx, ACCOUNTS.platform, feeCents, "PLATFORM_FEE", found.id);
        await notify(found.userId, { type: "billing", title: "Thank you for sponsoring rescues", body: `Your sponsorship of ${formatMoney(found.amountCents, found.currency)} is live on the impact page.`, link: "/impact", email: "now" }, tx);
        break;
      }
      case "PLATFORM_TIP":
        await ledger(tx, ACCOUNTS.platform, found.amountCents, "TIP", found.id);
        break;
    }
    await audit(found.userId, "order.paid", "Order", found.id, { kind: found.kind, amount: found.amountCents }, tx);
    return found;
  });

  if (order && refundReason) await refundOrder(order.id, refundReason);
  return order;
}

export async function markOrderFailed(providerOrderId: string) {
  const order = await db.order.findUnique({ where: { providerOrderId } });
  if (!order || order.status !== "CREATED") return;
  await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
  // The claim hold simply lapses in the sweep; the buyer can retry until then.
}

/** Full refund through the provider; reverses any ledger entries already written. */
export async function refundOrder(orderId: string, reason: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PAID") return;
  if (order.providerPaymentId || order.provider === "mock") {
    await getPaymentProvider().refund(order.providerPaymentId ?? `mock_${order.id}`, order.amountCents);
  }
  await db.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "REFUNDED", refundedAt: new Date() } });
    if (flipped.count === 0) return;
    const entries = await tx.ledgerEntry.findMany({ where: { orderId } });
    for (const e of entries) await ledger(tx, e.account, -e.amountCents, "REFUND", orderId, `Reversal: ${reason}`);
    await notify(order.userId, { type: "billing", title: "Refund issued", body: `${formatMoney(order.amountCents, order.currency)} refunded — ${reason}.`, link: "/dashboard/claims", email: "now" }, tx);
  });
}

// ─── Settlement: sellers are credited only when food changes hands ──

/** Called when a paid claim completes or the buyer no-shows (seller keeps the sale). */
export async function settleClaim(tx: Tx, claimId: string) {
  const order = await tx.order.findUnique({ where: { claimId } });
  if (!order || order.status !== "PAID") return;
  const already = await tx.ledgerEntry.count({ where: { orderId: order.id, type: "SALE_CREDIT" } });
  if (already) return;
  const claim = await tx.claim.findUniqueOrThrow({ where: { id: claimId }, include: { listing: true } });
  await ledger(tx, ACCOUNTS.user(claim.listing.ownerId), order.payeeAmountCents, "SALE_CREDIT", order.id, claim.listing.title);
  await ledger(tx, ACCOUNTS.platform, order.platformFeeCents, "PLATFORM_FEE", order.id);
  if (order.tipCents) await ledger(tx, ACCOUNTS.platform, order.tipCents, "TIP", order.id);
}

/** Volunteer stipend from the sponsor-funded Rescue Fund, if the fund can cover it. */
export async function payStipend(tx: Tx, taskId: string, volunteerId: string, distanceKm: number) {
  await lockAccount(tx, ACCOUNTS.fund);
  const stipend = volunteerStipendCents(distanceKm);
  if ((await balanceOf(ACCOUNTS.fund, tx)) < stipend) return 0;
  await ledger(tx, ACCOUNTS.fund, -stipend, "STIPEND", null, `Delivery ${taskId}`, taskId);
  await ledger(tx, ACCOUNTS.user(volunteerId), stipend, "STIPEND", null, "Delivery stipend", taskId);
  await tx.deliveryTask.update({ where: { id: taskId }, data: { stipendCents: stipend } });
  return stipend;
}

// ─── Payouts (manual UPI/bank transfer: zero platform fees) ──────────

export async function availableBalance(userId: string, tx?: Tx) {
  const client = tx ?? db;
  const [balance, pending] = await Promise.all([
    balanceOf(ACCOUNTS.user(userId), tx),
    client.payout.aggregate({ where: { userId, status: "REQUESTED" }, _sum: { amountCents: true } }),
  ]);
  return balance - (pending._sum.amountCents ?? 0);
}

export async function requestPayout(user: CurrentUser, amountCents: number, destination: string) {
  if (amountCents < PLATFORM.minPayoutCents) throw badRequest(`Minimum payout is ${formatMoney(PLATFORM.minPayoutCents, env.currency)}`);
  return db.$transaction(async (tx) => {
    await lockAccount(tx, ACCOUNTS.user(user.id));
    if ((await availableBalance(user.id, tx)) < amountCents) throw conflict("Amount exceeds your available balance");
    const payout = await tx.payout.create({ data: { userId: user.id, amountCents, currency: env.currency, destination } });
    await audit(user.id, "payout.requested", "Payout", payout.id, { amountCents }, tx);
    return payout;
  });
}

export async function processPayout(staffId: string, payoutId: string, approve: boolean, reference?: string, note?: string) {
  return db.$transaction(async (tx) => {
    const payout = await tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    if (payout.status !== "REQUESTED") throw conflict("Payout already processed");
    if (approve && !reference) throw badRequest("Enter the transfer reference (UTR / transaction id)");
    await tx.payout.update({
      where: { id: payoutId },
      data: { status: approve ? "PAID" : "REJECTED", reference: reference ?? null, note: note ?? null, processedAt: new Date() },
    });
    if (approve) await ledger(tx, ACCOUNTS.user(payout.userId), -payout.amountCents, "PAYOUT", null, reference, payout.id);
    await notify(payout.userId, {
      type: "billing",
      title: approve ? "Payout sent" : "Payout rejected",
      body: approve ? `${formatMoney(payout.amountCents, payout.currency)} sent (ref ${reference}).` : `Your payout request was rejected${note ? `: ${note}` : ""}.`,
      link: "/dashboard/billing",
      email: "now",
    }, tx);
    await audit(staffId, approve ? "payout.paid" : "payout.rejected", "Payout", payoutId, { reference }, tx);
  });
}

async function ledger(tx: Tx, account: string, amountCents: number, type: string, orderId: string | null, memo?: string | null, refId?: string) {
  if (amountCents === 0) return;
  await tx.ledgerEntry.create({ data: { account, amountCents, currency: env.currency, type, orderId, memo: memo ?? null, refId: refId ?? null } });
}
