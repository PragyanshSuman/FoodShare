import type { Plan } from "@prisma/client";
import { PLANS, PLATFORM } from "../config";

export type SaleBreakdown = {
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  platformFeeCents: number;
  payeeAmountCents: number;
};

/** Buyer pays price × qty (+ optional tip). The seller's commission comes out of the subtotal. */
export function saleBreakdown(unitPriceCents: number, quantity: number, sellerPlan: Plan, tipCents = 0): SaleBreakdown {
  if (unitPriceCents < 0 || quantity <= 0 || tipCents < 0) throw new Error("Invalid sale input");
  const subtotalCents = unitPriceCents * quantity;
  const platformFeeCents = Math.round((subtotalCents * PLANS[sellerPlan].saleCommissionBps) / 10_000);
  return {
    subtotalCents,
    tipCents,
    totalCents: subtotalCents + tipCents,
    platformFeeCents,
    payeeAmountCents: subtotalCents - platformFeeCents,
  };
}

export function sponsorshipBreakdown(amountCents: number) {
  const feeCents = Math.round((amountCents * PLATFORM.sponsorshipFeeBps) / 10_000);
  return {
    feeCents,
    fundCents: amountCents - feeCents,
    deliveriesFunded: Math.floor(amountCents / PLATFORM.sponsorCostPerDeliveryCents),
  };
}

export function volunteerStipendCents(distanceKm: number) {
  const raw = PLATFORM.stipendBaseCents + Math.round(distanceKm * PLATFORM.stipendPerKmCents);
  return Math.min(raw, PLATFORM.stipendMaxCents);
}

/** Buyer-initiated cancellation is refunded only if far enough ahead of the pickup deadline. */
export function buyerRefundEligible(pickupEnd: Date, now = new Date()) {
  return pickupEnd.getTime() - now.getTime() >= PLATFORM.refundCutoffMinutes * 60_000;
}

/** Extend a subscription from the later of now or the current period end. */
export function extendPlan(currentEnd: Date | null, months: number, now = new Date()) {
  const base = currentEnd && currentEnd > now ? new Date(currentEnd) : new Date(now);
  base.setUTCMonth(base.getUTCMonth() + months);
  return base;
}
