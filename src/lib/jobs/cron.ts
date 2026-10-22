import { db } from "../db";
import { env } from "../env";
import { PLATFORM } from "../config";
import { emailLayout, escapeHtml, sendEmail } from "../email";
import { sendPush } from "../push";
import { expireClaim, markNoShow } from "../services/claims";
import { matchAlerts } from "../services/alerts";
import { runDueSchedules } from "../services/schedules";
import { syncListingStatus } from "../services/claim-effects";
import { notify } from "../services/notifications";
import { enqueue, runDueJobs, type JobType } from "./queue";

const handlers: Record<JobType, (p: any) => Promise<void>> = {
  "email.send": async (p: { notificationId?: string; to?: string; subject?: string; html?: string; text?: string }) => {
    if (p.notificationId) {
      const n = await db.notification.findUnique({ where: { id: p.notificationId }, include: { user: { select: { email: true, status: true } } } });
      if (!n || n.emailedAt || n.user.status === "DELETED") return;
      await sendEmail(n.user.email, n.title, emailLayout(n.title, `<p>${escapeHtml(n.body)}</p>`, n.link ? { label: "Open FoodShare", url: env.appUrl + n.link } : undefined), n.body);
      await db.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
    } else if (p.to && p.subject && p.html) {
      await sendEmail(p.to, p.subject, p.html, p.text);
    }
  },
  "push.send": async (p: { userId: string; title: string; body: string; link: string | null }) => sendPush(p.userId, p),
  "alerts.match": async (p: { listingId: string; phase?: "initial" | "public" }) => matchAlerts(p.listingId, p.phase ?? "initial"),
  "digest.daily": async () => {
    await sendDigests();
    await enqueue("digest.daily", {}, { runAt: nextDigestTime() });
  },
};

/** One email per user per day with all pending alerts — keeps email volume inside free tiers. */
async function sendDigests() {
  const pending = await db.notification.findMany({
    where: { emailedAt: null, createdAt: { gt: new Date(Date.now() - 36 * 3600_000) } },
    include: { user: { select: { email: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);
  for (const [, items] of byUser) {
    const user = items[0].user;
    if (user.status !== "DELETED") {
      const list = items.slice(0, 15).map((n) => `<li style="margin-bottom:8px"><a href="${env.appUrl}${n.link ?? "/dashboard"}" style="color:#15803d">${escapeHtml(n.title)}</a><br><span style="color:#55635a">${escapeHtml(n.body)}</span></li>`).join("");
      await sendEmail(user.email, `${items.length} update${items.length > 1 ? "s" : ""} from FoodShare`, emailLayout("Your daily FoodShare digest", `<ul style="padding-left:18px">${list}</ul>`, { label: "See all", url: `${env.appUrl}/dashboard/notifications` }));
    }
    await db.notification.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { emailedAt: new Date() } });
  }
}

function nextDigestTime() {
  // 08:00 in the deployment's default timezone (IST = UTC+5:30 → 02:30 UTC).
  const d = new Date();
  d.setUTCHours(2, 30, 0, 0);
  if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Time-driven state changes. Every step is idempotent and bounded, so the
 * sweep can be triggered by an external free cron (every 5 min) or the
 * in-process timer without double effects.
 */
export async function sweep(now = new Date()) {
  const stats: Record<string, number> = {};

  // 1. Unpaid / unapproved holds lapse → stock returns to the listing.
  const lapsed = await db.claim.findMany({ where: { status: { in: ["PENDING_PAYMENT", "PENDING_APPROVAL"] }, holdExpiresAt: { lt: now } }, select: { id: true, status: true }, take: 200 });
  for (const c of lapsed) await expireClaim(c.id, c.status === "PENDING_PAYMENT" ? "Payment wasn't completed in time" : "The donor didn't respond in time");
  stats.holdsExpired = lapsed.length;

  // 2. Volunteer delivery nobody accepted by the end of the window.
  const graceMs = PLATFORM.noShowGraceMinutes * 60_000;
  const orphaned = await db.claim.findMany({
    where: { status: "CONFIRMED", fulfilment: "VOLUNTEER_DELIVERY", delivery: { status: "OPEN" }, listing: { pickupEnd: { lt: now } } },
    select: { id: true },
    take: 200,
  });
  for (const c of orphaned) await expireClaim(c.id, "No volunteer was available in time — sorry! Try self-pickup next time");
  stats.deliveriesUnfilled = orphaned.length;

  // 3. Self-pickups not collected within the grace period → no-show strike.
  const missed = await db.claim.findMany({
    where: { status: "CONFIRMED", fulfilment: "SELF_PICKUP", listing: { pickupEnd: { lt: new Date(now.getTime() - graceMs) } } },
    select: { id: true },
    take: 200,
  });
  for (const c of missed) await markNoShow(c.id);
  stats.noShows = missed.length;

  // 4. Volunteer accepted but never collected → reopen is pointless after the window; expire.
  const stalled = await db.claim.findMany({
    where: { status: "CONFIRMED", fulfilment: "VOLUNTEER_DELIVERY", delivery: { status: "ACCEPTED" }, listing: { pickupEnd: { lt: new Date(now.getTime() - graceMs) } } },
    select: { id: true },
    take: 200,
  });
  for (const c of stalled) await expireClaim(c.id, "The delivery couldn't be completed in time");
  stats.deliveriesStalled = stalled.length;

  // 5. Listings past their window/safe-until → EXPIRED / COMPLETED.
  const stale = await db.listing.findMany({ where: { status: { in: ["ACTIVE", "RESERVED"] }, OR: [{ pickupEnd: { lt: now } }, { expiresAt: { lt: now } }] }, select: { id: true }, take: 500 });
  for (const l of stale) await db.$transaction((tx) => syncListingStatus(tx, l.id));
  stats.listingsClosed = stale.length;

  // 6. Pickup reminders.
  const soon = new Date(now.getTime() + PLATFORM.pickupReminderMinutes * 60_000);
  const remind = await db.claim.findMany({
    where: { status: "CONFIRMED", reminderSentAt: null, fulfilment: "SELF_PICKUP", listing: { pickupEnd: { lte: soon, gt: now } } },
    include: { listing: { select: { title: true, pickupEnd: true } } },
    take: 500,
  });
  for (const c of remind) {
    await notify(c.claimantId, { type: "claim.reminder", title: "Pickup closes soon", body: `Collect ${c.listing.title} before ${c.listing.pickupEnd.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — or cancel so someone else can have it.`, link: `/dashboard/claims/${c.id}`, email: "now" });
    await db.claim.update({ where: { id: c.id }, data: { reminderSentAt: now } });
  }
  stats.reminders = remind.length;

  // 7. Unclaimed food about to expire: nudge the donor and re-broadcast to everyone nearby.
  const warn = new Date(now.getTime() + PLATFORM.expiryWarningMinutes * 60_000);
  const expiring = await db.listing.findMany({ where: { status: "ACTIVE", expiryWarnedAt: null, quantityAvailable: { gt: 0 }, pickupEnd: { lte: warn, gt: now } }, take: 200 });
  for (const l of expiring) {
    await db.listing.update({ where: { id: l.id }, data: { expiryWarnedAt: now, ngoPriorityUntil: null } });
    await notify(l.ownerId, { type: "listing.expiring", title: "Still unclaimed", body: `${l.quantityAvailable} ${l.unit} of ${l.title} left. Consider extending pickup or enabling volunteer delivery.`, link: `/listings/${l.id}`, email: "never" });
    await enqueue("alerts.match", { listingId: l.id, phase: "public" });
  }
  stats.expiryWarnings = expiring.length;

  // 8. Recurring listings.
  stats.scheduled = await runDueSchedules(now);

  // 9. Subscriptions: remind 3 days ahead, downgrade after expiry.
  const remindAt = new Date(now.getTime() + 3 * 86_400_000);
  const renewing = await db.organization.findMany({ where: { plan: { not: "FREE" }, planRenewsAt: { lte: remindAt, gt: now }, planReminderSentAt: null }, include: { members: { select: { id: true } } } });
  for (const o of renewing) {
    for (const m of o.members) await notify(m.id, { type: "billing", title: "Your Pro plan renews soon", body: `${o.name}'s Pro plan ends on ${o.planRenewsAt!.toDateString()}. Renew to keep recurring listings and CSR reports.`, link: "/dashboard/billing", email: "now" });
    await db.organization.update({ where: { id: o.id }, data: { planReminderSentAt: now } });
  }
  const lapsedPlans = await db.organization.updateMany({ where: { plan: { not: "FREE" }, planRenewsAt: { lt: now } }, data: { plan: "FREE" } });
  await db.recurringSchedule.updateMany({ where: { active: true, organizationId: { not: null }, owner: { organization: { plan: "FREE" } } }, data: { active: false } });
  stats.plansLapsed = lapsedPlans.count;

  // 10. Housekeeping keeps the free-tier database small.
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } });
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  await db.job.deleteMany({ where: { status: "DONE", createdAt: { lt: new Date(now.getTime() - 3 * 86_400_000) } } });
  await db.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } } });
  await db.order.updateMany({ where: { status: "CREATED", createdAt: { lt: new Date(now.getTime() - 86_400_000) } }, data: { status: "EXPIRED" } });

  // Unsuspend users whose suspension ended.
  await db.user.updateMany({ where: { status: "SUSPENDED", suspendedUntil: { lt: now } }, data: { status: "ACTIVE", suspendedUntil: null } });

  return stats;
}

let lastSweep = 0;

/** Entry point for /api/cron and the in-process timer. */
export async function runCron(opts: { forceSweep?: boolean } = {}) {
  const hasDigest = await db.job.count({ where: { type: "digest.daily", status: { in: ["PENDING", "RUNNING"] } } });
  if (!hasDigest) await enqueue("digest.daily", {}, { runAt: nextDigestTime() });

  const result: Record<string, unknown> = {};
  if (opts.forceSweep || Date.now() - lastSweep > 4 * 60_000) {
    lastSweep = Date.now();
    result.sweep = await sweep();
  }
  result.jobs = await runDueJobs(handlers);
  return result;
}

export { handlers as jobHandlers };
