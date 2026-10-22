// Platform rules in one place. Everything tunable without touching business logic.
import type { Plan } from "@prisma/client";

export const PLATFORM = {
  name: "FoodShare",

  // ── Fairness & abuse prevention ──
  maxActiveClaims: { INDIVIDUAL: 2, BUSINESS: 5, NGO: 25 } as const,
  maxClaimsPerDay: { INDIVIDUAL: 3, BUSINESS: 10, NGO: 60 } as const,
  noShowStrikeLimit: 3,
  suspensionDays: 14,
  noShowGraceMinutes: 30,
  maxCodeAttempts: 5,

  // ── Timing ──
  paymentHoldMinutes: 15,
  approvalHoldMinutes: 60,
  defaultNgoPriorityMinutes: 30,
  pickupReminderMinutes: 60,
  expiryWarningMinutes: 60,
  refundCutoffMinutes: 60, // buyer cancels later than this before pickupEnd → no refund

  // ── Food safety (enforced at listing creation) ──
  maxHoursHotFood: 4, // hot-held food must be eaten within 4h of preparation
  maxHoursPreparedMeal: 24,
  maxHoursChilledPrepared: 48,

  // ── Volunteer logistics ──
  maxDeliveryKm: 15,
  volunteerSearchKm: 10,
  stipendBaseCents: 3000, // paid from the sponsor-funded Rescue Fund
  stipendPerKmCents: 500,
  stipendMaxCents: 10000,
  minPayoutCents: 50000,

  // ── Monetisation ──
  sponsorshipFeeBps: 1000, // 10% platform management fee on sponsorships
  sponsorCostPerDeliveryCents: 6000,
  tipPresetsCents: [0, 1000, 2000, 5000],

  // ── Search ──
  defaultRadiusKm: 5,
  maxRadiusKm: 50,
  publicLocationPrecision: 2, // decimals ≈ 1.1 km — protects home addresses
} as const;

// Impact conversion factors (configurable; cite sources in docs/SCENARIOS.md).
export const IMPACT = {
  kgPerMeal: 0.5, // ≈ 1.1–1.2 lb per meal (food bank convention)
  co2ePerKg: 2.5, // kg CO2e avoided per kg of food not wasted (lifecycle avg.)
  waterLitresPerKg: 1000, // rough blue+green water footprint avg.
} as const;

export type Entitlements = {
  maxActiveListings: number;
  maxLocations: number;
  saleCommissionBps: number;
  recurringListings: boolean;
  csrReports: boolean;
  csvExport: boolean;
  approvalWorkflow: boolean;
};

// Individuals and NGOs are always FREE and never pay commission on donations.
export const PLANS: Record<Plan, Entitlements> = {
  FREE: {
    maxActiveListings: 5,
    maxLocations: 1,
    saleCommissionBps: 1500,
    recurringListings: false,
    csrReports: false,
    csvExport: false,
    approvalWorkflow: true,
  },
  PRO: {
    maxActiveListings: 100,
    maxLocations: 10,
    saleCommissionBps: 1000,
    recurringListings: true,
    csrReports: true,
    csvExport: true,
    approvalWorkflow: true,
  },
  ENTERPRISE: {
    maxActiveListings: 10_000,
    maxLocations: 500,
    saleCommissionBps: 700,
    recurringListings: true,
    csrReports: true,
    csvExport: true,
    approvalWorkflow: true,
  },
};

// Subscription prices per currency (minor units). Enterprise is sales-led.
export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  INR: { monthly: 99_900, yearly: 9_99_000 },
  USD: { monthly: 1_900, yearly: 19_000 },
  EUR: { monthly: 1_700, yearly: 17_000 },
  GBP: { monthly: 1_500, yearly: 15_000 },
};
