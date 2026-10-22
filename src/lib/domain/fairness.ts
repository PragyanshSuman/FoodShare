import type { AccountType, Audience, UserStatus, VerificationStatus } from "@prisma/client";
import { PLATFORM } from "../config";

export type Claimer = {
  id: string;
  accountType: AccountType;
  status: UserStatus;
  suspendedUntil: Date | null;
  emailVerified: boolean;
  orgKind?: "BUSINESS" | "NGO" | null;
  orgVerification?: VerificationStatus | null;
  activeClaims: number;
  claimsToday: number;
};

export type ClaimableListing = {
  ownerId: string;
  status: string;
  quantityAvailable: number;
  maxPerClaim: number | null;
  audience: Audience;
  ngoPriorityUntil: Date | null;
  pickupEnd: Date;
  expiresAt: Date;
};

export function isVerifiedNgo(c: Pick<Claimer, "orgKind" | "orgVerification">) {
  return c.orgKind === "NGO" && c.orgVerification === "VERIFIED";
}

/** Returns a human-readable reason the claim is not allowed, or null if it is. */
export function claimBlocker(c: Claimer, l: ClaimableListing, quantity: number, now = new Date()): string | null {
  if (c.status === "DELETED") return "Account is closed";
  if (c.status === "SUSPENDED" && (!c.suspendedUntil || c.suspendedUntil > now))
    return "Your account is temporarily suspended after repeated no-shows";
  if (!c.emailVerified) return "Verify your email before claiming food";
  if (l.ownerId === c.id) return "You cannot claim your own listing";
  if (l.status !== "ACTIVE") return "This listing is no longer available";
  if (l.pickupEnd <= now || l.expiresAt <= now) return "The pickup window has closed";
  if (!Number.isInteger(quantity) || quantity < 1) return "Quantity must be at least 1";
  if (quantity > l.quantityAvailable) return `Only ${l.quantityAvailable} left`;
  if (l.maxPerClaim && quantity > l.maxPerClaim) return `Maximum ${l.maxPerClaim} per claim`;

  const ngo = isVerifiedNgo(c);
  if (l.audience === "VERIFIED_NGO_ONLY" && !ngo) return "This listing is reserved for verified NGOs";
  if (l.ngoPriorityUntil && l.ngoPriorityUntil > now && !ngo)
    return "Verified NGOs get first access to this listing — it opens to everyone shortly";

  // An NGO account that is not yet verified gets individual limits.
  const tier: AccountType = ngo ? "NGO" : c.accountType === "NGO" ? "INDIVIDUAL" : c.accountType;
  if (c.activeClaims >= PLATFORM.maxActiveClaims[tier])
    return "You have reached the limit of active claims — complete a pickup first";
  if (c.claimsToday >= PLATFORM.maxClaimsPerDay[tier])
    return "Daily claim limit reached — this keeps food available for everyone";
  return null;
}

/** Returns the new strike count and a suspension end if the limit is reached. */
export function applyNoShowStrike(strikes: number, now = new Date()) {
  const next = strikes + 1;
  if (next >= PLATFORM.noShowStrikeLimit) {
    return { strikes: 0, suspendedUntil: new Date(now.getTime() + PLATFORM.suspensionDays * 86_400_000) };
  }
  return { strikes: next, suspendedUntil: null };
}
