import { db } from "../db";
import { conflict } from "../errors";
import type { CurrentUser } from "../auth/session";
import { ACTIVE_CLAIM_STATUSES } from "../domain/claim-state";
import { availableBalance } from "./billing";
import { cancelClaim } from "./claims";
import { cancelListing } from "./listings";
import { audit } from "./audit";

/** Right of access (GDPR art. 15 / India DPDP Act 2023 s.11): everything we hold about you. */
export async function exportAccount(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, phone: true, accountType: true, city: true, lat: true, lng: true,
      isVolunteer: true, createdAt: true, ratingAvg: true, ratingCount: true, completedCount: true,
      organization: { select: { name: true, kind: true, category: true, website: true, registrationNumber: true } },
      listings: { select: { id: true, title: true, status: true, createdAt: true } },
      claims: { select: { id: true, listingId: true, quantity: true, status: true, createdAt: true } },
      reviewsWritten: { select: { claimId: true, rating: true, comment: true, createdAt: true } },
      reviewsReceived: { select: { claimId: true, rating: true, comment: true, createdAt: true } },
      orders: { select: { id: true, kind: true, status: true, amountCents: true, currency: true, createdAt: true } },
      alerts: true,
      notifications: { select: { title: true, body: true, createdAt: true }, take: 500, orderBy: { createdAt: "desc" } },
    },
  });
}

/**
 * Right to erasure: anonymise rather than hard-delete so donation history,
 * financial records and other users' reviews stay consistent.
 */
export async function deleteAccount(user: CurrentUser) {
  if ((await availableBalance(user.id)) > 0) throw conflict("Withdraw your remaining balance before closing your account");

  for (const l of await db.listing.findMany({ where: { ownerId: user.id, status: { in: ["ACTIVE", "RESERVED"] } }, select: { id: true } })) {
    await cancelListing(user, l.id, "Donor closed their account");
  }
  for (const c of await db.claim.findMany({ where: { claimantId: user.id, status: { in: ACTIVE_CLAIM_STATUSES } }, select: { id: true } })) {
    await cancelClaim(user, c.id, "Recipient closed their account", { force: true });
  }
  await db.$transaction([
    db.deliveryTask.updateMany({ where: { volunteerId: user.id, status: "ACCEPTED" }, data: { status: "OPEN", volunteerId: null, acceptedAt: null } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.pushSubscription.deleteMany({ where: { userId: user.id } }),
    db.alertPreference.deleteMany({ where: { userId: user.id } }),
    db.authToken.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        email: `deleted+${user.id}@invalid.local`,
        name: "Deleted user",
        phone: null,
        lat: null,
        lng: null,
        city: null,
        passwordHash: "!",
        isVolunteer: false,
        organizationId: null,
      },
    }),
  ]);
  await audit(user.id, "account.deleted", "User", user.id);
}
