import { db } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { isStaff } from "../auth/guards";
import type { CurrentUser } from "../auth/session";
import { rateLimit } from "../rate-limit";
import { notify, notifyStaff } from "./notifications";
import { audit } from "./audit";
import { cancelListing } from "./listings";

// ─── Per-claim chat (polling, no websockets → no always-on connections to pay for) ─

async function participants(claimId: string) {
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    select: { claimantId: true, status: true, listing: { select: { ownerId: true, title: true } }, delivery: { select: { volunteerId: true } } },
  });
  if (!claim) throw notFound("Claim");
  const ids = [claim.claimantId, claim.listing.ownerId, claim.delivery?.volunteerId].filter(Boolean) as string[];
  return { claim, ids };
}

export async function listMessages(user: CurrentUser, claimId: string, after?: Date) {
  const { ids } = await participants(claimId);
  if (!ids.includes(user.id) && !isStaff(user)) throw forbidden();
  return db.message.findMany({
    where: { claimId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { id: true, name: true } } },
  });
}

export async function sendMessage(user: CurrentUser, claimId: string, body: string) {
  const text = body.trim();
  if (!text || text.length > 1000) throw badRequest("Message must be 1–1000 characters");
  const { claim, ids } = await participants(claimId);
  if (!ids.includes(user.id)) throw forbidden();
  if (["CANCELLED", "REJECTED", "EXPIRED"].includes(claim.status)) throw conflict("This conversation is closed");
  await rateLimit(`msg:${user.id}`, 30, 60);

  const message = await db.message.create({ data: { claimId, senderId: user.id, body: text } });
  for (const id of ids.filter((i) => i !== user.id)) {
    await notify(id, { type: "message", title: `${user.name.split(" ")[0]} · ${claim.listing.title}`, body: text.slice(0, 120), link: `/dashboard/claims/${claimId}`, email: "never" });
  }
  return message;
}

// ─── Reviews ───────────────────────────────────────────────────────────

const REVIEW_WINDOW_DAYS = 14;

export async function createReview(user: CurrentUser, claimId: string, input: { rating: number; tags: string[]; comment: string | null }) {
  const claim = await db.claim.findUnique({ where: { id: claimId }, include: { listing: { select: { ownerId: true } } } });
  if (!claim) throw notFound("Claim");
  const isClaimant = claim.claimantId === user.id;
  const isDonor = claim.listing.ownerId === user.id;
  if (!isClaimant && !isDonor) throw forbidden();
  // Donors may also review a no-show; claimants only review food they received.
  const allowed = claim.status === "COMPLETED" || (isDonor && claim.status === "NO_SHOW");
  if (!allowed) throw conflict("You can review once the pickup is complete");
  const ref = claim.completedAt ?? claim.updatedAt;
  if (Date.now() - ref.getTime() > REVIEW_WINDOW_DAYS * 86_400_000) throw conflict("The review window has closed");

  const subjectId = isClaimant ? claim.listing.ownerId : claim.claimantId;
  return db.$transaction(async (tx) => {
    const review = await tx.review.create({ data: { claimId, authorId: user.id, subjectId, ...input } });
    const agg = await tx.review.aggregate({ where: { subjectId }, _avg: { rating: true }, _count: true });
    await tx.user.update({ where: { id: subjectId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count } });
    if (input.rating <= 2) {
      await notifyStaff({ type: "review.low", title: "Low rating to review", body: `${input.rating}★ on claim ${claimId}: ${input.comment ?? "(no comment)"}`, link: "/admin/reports" }, tx);
    }
    return review;
  });
}

// ─── Reports & moderation ──────────────────────────────────────────────

const AUTO_HIDE_FOOD_SAFETY_REPORTS = 3;

export async function createReport(
  user: CurrentUser,
  input: { targetType: "LISTING" | "USER" | "CLAIM"; targetId: string; reason: "FOOD_SAFETY" | "NO_SHOW" | "MISREPRESENTED" | "HARASSMENT" | "FRAUD" | "OTHER"; details: string | null },
) {
  await rateLimit(`report:${user.id}`, 10, 3600);
  const dupe = await db.report.findFirst({ where: { reporterId: user.id, targetType: input.targetType, targetId: input.targetId, status: "OPEN" } });
  if (dupe) throw conflict("You've already reported this — our team is on it");

  const report = await db.report.create({ data: { reporterId: user.id, ...input } });
  const urgent = input.reason === "FOOD_SAFETY";
  await notifyStaff({ type: "report", title: `${urgent ? "URGENT " : ""}Report: ${input.reason}`, body: input.details ?? `${input.targetType} ${input.targetId}`, link: "/admin/reports", email: urgent ? "now" : "digest" });

  // Safety valve: several independent food-safety reports pull a listing before a human looks.
  if (input.targetType === "LISTING" && urgent) {
    const reporters = await db.report.findMany({
      where: { targetType: "LISTING", targetId: input.targetId, reason: "FOOD_SAFETY", status: "OPEN" },
      distinct: ["reporterId"],
      select: { id: true },
    });
    if (reporters.length >= AUTO_HIDE_FOOD_SAFETY_REPORTS) {
      const system = await db.user.findFirst({ where: { role: "ADMIN" }, include: { organization: true } });
      if (system) await cancelListing(system, input.targetId, "Paused after multiple food-safety reports", { removed: true });
    }
  }
  return report;
}

export type ModerationAction = "dismiss" | "remove_listing" | "suspend_user" | "warn_user";

export async function resolveReport(staff: CurrentUser, reportId: string, action: ModerationAction, note: string, suspendDays = 14) {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report");
  if (report.status !== "OPEN") throw conflict("Report already resolved");

  let targetUserId: string | null = null;
  if (report.targetType === "USER") targetUserId = report.targetId;
  if (report.targetType === "LISTING") targetUserId = (await db.listing.findUnique({ where: { id: report.targetId } }))?.ownerId ?? null;
  if (report.targetType === "CLAIM") targetUserId = (await db.claim.findUnique({ where: { id: report.targetId } }))?.claimantId ?? null;

  if (action === "remove_listing") {
    if (report.targetType !== "LISTING") throw badRequest("This report is not about a listing");
    await cancelListing(staff, report.targetId, `Removed by moderation: ${note}`, { removed: true });
  }
  if (action === "suspend_user" && targetUserId) {
    await db.user.update({ where: { id: targetUserId }, data: { status: "SUSPENDED", suspendedUntil: new Date(Date.now() + suspendDays * 86_400_000) } });
    await db.session.deleteMany({ where: { userId: targetUserId } });
  }
  if ((action === "warn_user" || action === "suspend_user") && targetUserId) {
    await notify(targetUserId, { type: "moderation", title: action === "warn_user" ? "Community guidelines warning" : "Account suspended", body: note, link: "/guides/community-guidelines", email: "now" });
  }

  await db.report.update({
    where: { id: reportId },
    data: { status: action === "dismiss" ? "DISMISSED" : "ACTIONED", resolverId: staff.id, resolutionNote: note, resolvedAt: new Date() },
  });
  await audit(staff.id, `report.${action}`, "Report", reportId, { note, targetUserId });
}

// ─── Organisation verification ─────────────────────────────────────────

export async function submitVerification(user: CurrentUser, docs: { docType: string; fileKey: string }[]) {
  const org = user.organization;
  if (!org) throw badRequest("Create your organisation profile first");
  if (!docs.length) throw badRequest("Attach at least one document");
  if (docs.some((d) => !d.fileKey.startsWith(`private/verification/${user.id}/`))) throw forbidden("Unknown document");
  if (!org.registrationNumber) throw badRequest("Add your registration / licence number to the profile first");

  await db.$transaction(async (tx) => {
    await tx.verificationDocument.createMany({ data: docs.map((d) => ({ organizationId: org.id, ...d })) });
    await tx.organization.update({ where: { id: org.id }, data: { verificationStatus: "PENDING", rejectionReason: null } });
    await notifyStaff({ type: "verification", title: "Verification request", body: `${org.name} (${org.kind}) submitted ${docs.length} document(s).`, link: "/admin/verifications" }, tx);
    await audit(user.id, "org.verification_submitted", "Organization", org.id, { docs: docs.length }, tx);
  });
}

export async function reviewVerification(staff: CurrentUser, organizationId: string, approve: boolean, note?: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, include: { members: { select: { id: true } } } });
  if (!org) throw notFound("Organisation");
  if (!approve && !note) throw badRequest("Tell the organisation why it was rejected");

  await db.$transaction(async (tx) => {
    await tx.verificationDocument.updateMany({
      where: { organizationId, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "REJECTED", reviewerId: staff.id, reviewNote: note ?? null, reviewedAt: new Date() },
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: approve ? { verificationStatus: "VERIFIED", verifiedAt: new Date(), rejectionReason: null } : { verificationStatus: "REJECTED", rejectionReason: note },
    });
    for (const m of org.members) {
      await notify(m.id, {
        type: "verification",
        title: approve ? `${org.name} is verified ✔` : "Verification needs changes",
        body: approve
          ? org.kind === "NGO" ? "You now get priority access to new listings and higher claim limits." : "You can now sell surplus and show the verified badge."
          : note!,
        link: "/dashboard/organization",
        email: "now",
      }, tx);
    }
    await audit(staff.id, approve ? "org.verified" : "org.rejected", "Organization", organizationId, { note }, tx);
  });
}
