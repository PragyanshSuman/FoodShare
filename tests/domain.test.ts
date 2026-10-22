import { describe, expect, it } from "vitest";
import { canTransitionClaim, deriveListingStatus, releasesQuantity } from "@/lib/domain/claim-state";
import { buyerRefundEligible, extendPlan, saleBreakdown, sponsorshipBreakdown, volunteerStipendCents } from "@/lib/domain/pricing";
import { applyNoShowStrike, claimBlocker, type ClaimableListing, type Claimer } from "@/lib/domain/fairness";
import { listingViolations, type ListingTiming } from "@/lib/domain/listing-rules";
import { impactFor } from "@/lib/domain/impact";
import { nextRunAt } from "@/lib/domain/schedule";
import { boundingBox, fuzz, haversineKm } from "@/lib/geo";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { hmacHex } from "@/lib/crypto";

const NOW = new Date("2026-10-22T12:00:00Z");
const mins = (m: number) => new Date(NOW.getTime() + m * 60_000);

describe("claim state machine", () => {
  it("allows the happy paths", () => {
    expect(canTransitionClaim("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransitionClaim("CONFIRMED", "IN_DELIVERY")).toBe(true);
    expect(canTransitionClaim("IN_DELIVERY", "COMPLETED")).toBe(true);
  });
  it("blocks leaving terminal states", () => {
    expect(canTransitionClaim("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionClaim("NO_SHOW", "CONFIRMED")).toBe(false);
  });
  it("lets a late payment revive an expired hold", () => {
    expect(canTransitionClaim("EXPIRED", "CONFIRMED")).toBe(true);
  });
  it("releases stock only when an active claim ends without handover", () => {
    expect(releasesQuantity("CONFIRMED", "CANCELLED")).toBe(true);
    expect(releasesQuantity("PENDING_PAYMENT", "EXPIRED")).toBe(true);
    expect(releasesQuantity("CONFIRMED", "COMPLETED")).toBe(false);
    expect(releasesQuantity("CONFIRMED", "NO_SHOW")).toBe(false);
  });
});

describe("listing status derivation", () => {
  const base = { current: "ACTIVE" as const, quantityAvailable: 0, activeClaims: 0, completedClaims: 0, pastDeadline: false };
  it("is RESERVED when fully claimed but not collected", () => {
    expect(deriveListingStatus({ ...base, activeClaims: 2 })).toBe("RESERVED");
  });
  it("stays ACTIVE with partial claims and stock left", () => {
    expect(deriveListingStatus({ ...base, quantityAvailable: 3, activeClaims: 1 })).toBe("ACTIVE");
  });
  it("is COMPLETED once everything is handed over", () => {
    expect(deriveListingStatus({ ...base, completedClaims: 2 })).toBe("COMPLETED");
  });
  it("is COMPLETED (not EXPIRED) when partly rescued before the deadline", () => {
    expect(deriveListingStatus({ ...base, quantityAvailable: 4, completedClaims: 1, pastDeadline: true })).toBe("COMPLETED");
  });
  it("is EXPIRED when nothing was rescued", () => {
    expect(deriveListingStatus({ ...base, quantityAvailable: 5, pastDeadline: true })).toBe("EXPIRED");
  });
  it("goes back to ACTIVE when a cancellation returns stock", () => {
    expect(deriveListingStatus({ ...base, current: "RESERVED", quantityAvailable: 2 })).toBe("ACTIVE");
  });
  it("never resurrects cancelled or removed listings", () => {
    expect(deriveListingStatus({ ...base, current: "REMOVED", quantityAvailable: 5 })).toBe("REMOVED");
  });
});

describe("pricing & money", () => {
  it("takes commission from the seller, not the buyer", () => {
    const b = saleBreakdown(12_000, 2, "FREE", 1_000);
    expect(b).toEqual({ subtotalCents: 24_000, tipCents: 1_000, totalCents: 25_000, platformFeeCents: 3_600, payeeAmountCents: 20_400 });
  });
  it("gives Pro sellers a lower commission", () => {
    expect(saleBreakdown(10_000, 1, "PRO").platformFeeCents).toBe(1_000);
    expect(saleBreakdown(10_000, 1, "ENTERPRISE").platformFeeCents).toBe(700);
  });
  it("splits sponsorships into fund + 10% fee", () => {
    expect(sponsorshipBreakdown(600_000)).toEqual({ feeCents: 60_000, fundCents: 540_000, deliveriesFunded: 100 });
  });
  it("caps volunteer stipends", () => {
    expect(volunteerStipendCents(2)).toBe(4_000);
    expect(volunteerStipendCents(100)).toBe(10_000);
  });
  it("refunds buyer cancellations only ahead of the cutoff", () => {
    expect(buyerRefundEligible(mins(90), NOW)).toBe(true);
    expect(buyerRefundEligible(mins(30), NOW)).toBe(false);
  });
  it("stacks subscription renewals on the current period", () => {
    expect(extendPlan(new Date("2026-11-10T00:00:00Z"), 1, NOW).toISOString()).toBe("2026-12-10T00:00:00.000Z");
    expect(extendPlan(new Date("2026-01-01T00:00:00Z"), 12, NOW).toISOString()).toBe("2027-10-22T12:00:00.000Z");
  });
});

describe("fairness rules", () => {
  const claimer: Claimer = {
    id: "u1", accountType: "INDIVIDUAL", status: "ACTIVE", suspendedUntil: null, emailVerified: true,
    orgKind: null, orgVerification: null, activeClaims: 0, claimsToday: 0,
  };
  const listing: ClaimableListing = {
    ownerId: "donor", status: "ACTIVE", quantityAvailable: 5, maxPerClaim: 3, audience: "EVERYONE",
    ngoPriorityUntil: null, pickupEnd: mins(60), expiresAt: mins(120),
  };
  it("accepts a normal claim", () => expect(claimBlocker(claimer, listing, 2, NOW)).toBeNull());
  it("rejects claiming your own food", () => expect(claimBlocker({ ...claimer, id: "donor" }, listing, 1, NOW)).toMatch(/own listing/));
  it("enforces per-claim max and stock", () => {
    expect(claimBlocker(claimer, listing, 4, NOW)).toMatch(/Maximum 3/);
    expect(claimBlocker(claimer, { ...listing, maxPerClaim: null }, 6, NOW)).toMatch(/Only 5 left/);
  });
  it("requires email verification", () => expect(claimBlocker({ ...claimer, emailVerified: false }, listing, 1, NOW)).toMatch(/Verify/));
  it("reserves NGO-priority listings for verified NGOs", () => {
    const priority = { ...listing, ngoPriorityUntil: mins(10) };
    expect(claimBlocker(claimer, priority, 1, NOW)).toMatch(/NGOs get first access/);
    expect(claimBlocker({ ...claimer, accountType: "NGO", orgKind: "NGO", orgVerification: "VERIFIED" }, priority, 1, NOW)).toBeNull();
    expect(claimBlocker({ ...claimer, accountType: "NGO", orgKind: "NGO", orgVerification: "PENDING" }, priority, 1, NOW)).toMatch(/NGOs/);
  });
  it("limits active claims per tier", () => {
    expect(claimBlocker({ ...claimer, activeClaims: 2 }, listing, 1, NOW)).toMatch(/limit of active claims/);
    expect(claimBlocker({ ...claimer, accountType: "NGO", orgKind: "NGO", orgVerification: "VERIFIED", activeClaims: 2 }, listing, 1, NOW)).toBeNull();
  });
  it("blocks suspended users until the suspension ends", () => {
    expect(claimBlocker({ ...claimer, status: "SUSPENDED", suspendedUntil: mins(60) }, listing, 1, NOW)).toMatch(/suspended/);
    expect(claimBlocker({ ...claimer, status: "SUSPENDED", suspendedUntil: mins(-1) }, listing, 1, NOW)).toBeNull();
  });
  it("blocks closed pickup windows", () => expect(claimBlocker(claimer, { ...listing, pickupEnd: mins(-1) }, 1, NOW)).toMatch(/closed/));
  it("suspends on the third no-show and resets strikes", () => {
    expect(applyNoShowStrike(0, NOW)).toEqual({ strikes: 1, suspendedUntil: null });
    const third = applyNoShowStrike(2, NOW);
    expect(third.strikes).toBe(0);
    expect(third.suspendedUntil?.toISOString()).toBe("2026-11-05T12:00:00.000Z");
  });
});

describe("food-safety listing rules", () => {
  const ok: ListingTiming = {
    mode: "DONATION", category: "PREPARED_MEAL", storage: "AMBIENT", preparedAt: mins(-60),
    expiresAt: mins(300), pickupStart: mins(0), pickupEnd: mins(180), priceCents: 0, originalPriceCents: null,
    safetyAck: true, requiresApproval: false,
  };
  it("accepts a valid cooked donation", () => expect(listingViolations(ok, NOW)).toEqual([]));
  it("requires the safety checklist and prep time for cooked food", () => {
    expect(listingViolations({ ...ok, safetyAck: false, preparedAt: null }, NOW)).toEqual(
      expect.arrayContaining([expect.stringMatching(/preparation time/), expect.stringMatching(/checklist/)]),
    );
  });
  it("enforces the 4-hour rule for hot-held food", () => {
    expect(listingViolations({ ...ok, storage: "HOT", expiresAt: mins(240), pickupEnd: mins(200) }, NOW)).toEqual([
      expect.stringMatching(/within 4h/),
    ]);
  });
  it("rejects pickup after the safe-until time", () => {
    expect(listingViolations({ ...ok, pickupEnd: mins(400) }, NOW)).toContainEqual(expect.stringMatching(/before the food's safe-until/));
  });
  it("requires real discounts for sales", () => {
    const sale = { ...ok, category: "BAKERY" as const, storage: "AMBIENT" as const, mode: "SALE" as const, priceCents: 9_000, originalPriceCents: 10_000 };
    expect(listingViolations(sale, NOW)).toContainEqual(expect.stringMatching(/30% off/));
    expect(listingViolations({ ...sale, priceCents: 5_000 }, NOW)).toEqual([]);
  });
  it("forbids priced donations and approval on paid listings", () => {
    expect(listingViolations({ ...ok, priceCents: 100 }, NOW)).toContainEqual("Donations must be free");
    expect(listingViolations({ ...ok, mode: "SALE", priceCents: 100, originalPriceCents: 1000, requiresApproval: true }, NOW)).toContainEqual(
      expect.stringMatching(/approval/),
    );
  });
});

describe("impact", () => {
  it("converts weight into meals and emissions", () => {
    expect(impactFor(10, 0.5)).toEqual({ kgSaved: 5, meals: 10, co2eKg: 12.5, waterLitres: 5000 });
  });
});

describe("recurring schedules", () => {
  it("finds the next weekday occurrence in local time (IST)", () => {
    // 2026-10-22 is a Thursday. 20:00 IST = 14:30 UTC → today still ahead.
    expect(nextRunAt([4], "20:00", 330, NOW).toISOString()).toBe("2026-10-22T14:30:00.000Z");
    // Friday only → tomorrow.
    expect(nextRunAt([5], "20:00", 330, NOW).toISOString()).toBe("2026-10-23T14:30:00.000Z");
    // Thursday 09:00 IST already passed → next Thursday.
    expect(nextRunAt([4], "09:00", 330, NOW).toISOString()).toBe("2026-10-29T03:30:00.000Z");
  });
});

describe("geo", () => {
  it("measures distance", () => {
    // Connaught Place → India Gate ≈ 2.4 km
    expect(haversineKm(28.6315, 77.2167, 28.6129, 77.2295)).toBeCloseTo(2.4, 0);
  });
  it("builds a bounding box that contains the radius", () => {
    const b = boundingBox(28.6, 77.2, 5);
    expect(haversineKm(28.6, 77.2, b.maxLat, 77.2)).toBeCloseTo(5, 1);
    expect(b.minLng).toBeLessThan(77.2);
  });
  it("fuzzes public coordinates", () => expect(fuzz(28.613912, 2)).toBe(28.61));
});

describe("webhook signatures", () => {
  it("accepts a valid Stripe signature and rejects replays", () => {
    const body = '{"id":"evt_1"}';
    const t = Math.floor(NOW.getTime() / 1000);
    const header = `t=${t},v1=${hmacHex(`${t}.${body}`, "whsec_test")}`;
    expect(verifyStripeSignature(body, header, "whsec_test", NOW.getTime())).toBe(true);
    expect(verifyStripeSignature(body + " ", header, "whsec_test", NOW.getTime())).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_test", NOW.getTime() + 10 * 60_000)).toBe(false);
  });
});
