import { db } from "../db";
import { ACCOUNTS, balanceOf } from "./billing";

/** Operator dashboard numbers: marketplace health + unit economics. */
export async function adminStats() {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [users, newUsers, activeListings, claims30, completed30, noShows30, gmv30, revenueByType, fund, openReports, pendingVerifications, pendingPayouts, failedJobs] =
    await Promise.all([
      db.user.count({ where: { status: { not: "DELETED" } } }),
      db.user.count({ where: { createdAt: { gte: since30 } } }),
      db.listing.count({ where: { status: "ACTIVE" } }),
      db.claim.count({ where: { createdAt: { gte: since30 } } }),
      db.claim.count({ where: { status: "COMPLETED", completedAt: { gte: since30 } } }),
      db.claim.count({ where: { status: "NO_SHOW", updatedAt: { gte: since30 } } }),
      db.order.aggregate({ where: { kind: "LISTING_PURCHASE", status: "PAID", paidAt: { gte: since30 } }, _sum: { amountCents: true } }),
      db.ledgerEntry.groupBy({ by: ["type"], where: { account: ACCOUNTS.platform, createdAt: { gte: since30 } }, _sum: { amountCents: true } }),
      balanceOf(ACCOUNTS.fund),
      db.report.count({ where: { status: "OPEN" } }),
      db.organization.count({ where: { verificationStatus: "PENDING" } }),
      db.payout.count({ where: { status: "REQUESTED" } }),
      db.job.count({ where: { status: "FAILED" } }),
    ]);
  const revenue30 = revenueByType.reduce((s, r) => s + (r._sum.amountCents ?? 0), 0);
  return {
    users,
    newUsers,
    activeListings,
    claims30,
    completed30,
    completionRate: claims30 ? Math.round((completed30 / claims30) * 100) : 0,
    noShows30,
    gmv30: gmv30._sum.amountCents ?? 0,
    revenue30,
    revenueByType: Object.fromEntries(revenueByType.map((r) => [r.type, r._sum.amountCents ?? 0])),
    rescueFund: fund,
    queues: { openReports, pendingVerifications, pendingPayouts, failedJobs },
  };
}
