import type { ClaimStatus, ListingStatus } from "@prisma/client";
import { conflict } from "../errors";

// Allowed claim transitions. Anything not listed is rejected.
const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  PENDING_APPROVAL: ["CONFIRMED", "REJECTED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["IN_DELIVERY", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"],
  IN_DELIVERY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
  NO_SHOW: [],
  EXPIRED: ["CONFIRMED"], // a late payment webhook can revive a claim if stock remains
};

/** Statuses that hold quantity on the listing. */
export const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "IN_DELIVERY"];
export const TERMINAL_CLAIM_STATUSES: ClaimStatus[] = ["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW", "EXPIRED"];

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus) {
  return CLAIM_TRANSITIONS[from].includes(to);
}

export function assertClaimTransition(from: ClaimStatus, to: ClaimStatus) {
  if (!canTransitionClaim(from, to)) throw conflict(`Claim cannot move from ${from} to ${to}`);
}

/** Does moving into `to` release the held quantity back to the listing? */
export function releasesQuantity(from: ClaimStatus, to: ClaimStatus) {
  return ACTIVE_CLAIM_STATUSES.includes(from) && ["CANCELLED", "REJECTED", "EXPIRED"].includes(to);
}

/**
 * Derive listing status from quantity and claims. Single source of truth so
 * every code path (claim, cancel, sweep, payment) lands on the same answer.
 */
export function deriveListingStatus(input: {
  current: ListingStatus;
  quantityAvailable: number;
  activeClaims: number;
  completedClaims: number;
  pastDeadline: boolean;
}): ListingStatus {
  const { current, quantityAvailable, activeClaims, completedClaims, pastDeadline } = input;
  if (current === "CANCELLED" || current === "REMOVED" || current === "DRAFT") return current;
  if (activeClaims > 0) return quantityAvailable > 0 && !pastDeadline ? "ACTIVE" : "RESERVED";
  if (completedClaims > 0 && (quantityAvailable === 0 || pastDeadline)) return "COMPLETED";
  if (pastDeadline) return "EXPIRED";
  return quantityAvailable > 0 ? "ACTIVE" : "COMPLETED";
}
