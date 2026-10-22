import { db } from "../db";
import { IMPACT } from "../config";

export type ImpactTotals = { rescues: number; kgSaved: number; meals: number; co2eKg: number; waterLitres: number };

function totals(row: { rescues: bigint | number; kg: number | null; meals: number | null; co2: number | null }): ImpactTotals {
  const kg = Number(row.kg ?? 0);
  return {
    rescues: Number(row.rescues),
    kgSaved: round(kg),
    meals: Math.round(Number(row.meals ?? 0)),
    co2eKg: round(Number(row.co2 ?? 0)),
    waterLitres: Math.round(kg * IMPACT.waterLitresPerKg),
  };
}

/** Impact for a person across all three roles: donor, recipient, volunteer. */
export async function userImpact(userId: string) {
  const [asDonor, asRecipient, asVolunteer] = await Promise.all([
    db.$queryRaw<any[]>`SELECT count(*) rescues, sum(c."kgSaved") kg, sum(c.meals) meals, sum(c."co2eKg") co2
      FROM "Claim" c JOIN "Listing" l ON l.id = c."listingId" WHERE c.status = 'COMPLETED' AND l."ownerId" = ${userId}`,
    db.$queryRaw<any[]>`SELECT count(*) rescues, sum(c."kgSaved") kg, sum(c.meals) meals, sum(c."co2eKg") co2
      FROM "Claim" c WHERE c.status = 'COMPLETED' AND c."claimantId" = ${userId}`,
    db.$queryRaw<any[]>`SELECT count(*) rescues, sum(c."kgSaved") kg, sum(c.meals) meals, sum(c."co2eKg") co2
      FROM "Claim" c JOIN "DeliveryTask" d ON d."claimId" = c.id WHERE c.status = 'COMPLETED' AND d."volunteerId" = ${userId}`,
  ]);
  return { donated: totals(asDonor[0]), received: totals(asRecipient[0]), delivered: totals(asVolunteer[0]) };
}

/** CSR / ESG report rows for an organisation over a date range. */
export async function organizationReport(organizationId: string, from: Date, to: Date) {
  const rows = await db.claim.findMany({
    where: { status: "COMPLETED", completedAt: { gte: from, lte: to }, listing: { organizationId } },
    orderBy: { completedAt: "asc" },
    include: {
      listing: { select: { title: true, category: true, unit: true, originalPriceCents: true, currency: true, mode: true, address: true } },
      claimant: { select: { name: true, organization: { select: { name: true, kind: true, registrationNumber: true } } } },
      delivery: { select: { distanceKm: true } },
    },
  });
  const sum = rows.reduce(
    (a, r) => ({ kg: a.kg + (r.kgSaved ?? 0), meals: a.meals + (r.meals ?? 0), co2: a.co2 + (r.co2eKg ?? 0), value: a.value + (r.listing.originalPriceCents ?? 0) * r.quantity }),
    { kg: 0, meals: 0, co2: 0, value: 0 },
  );
  const recipients = new Set(rows.map((r) => r.claimant.organization?.name ?? r.claimant.name));
  return {
    rows,
    summary: { ...totals({ rescues: rows.length, kg: sum.kg, meals: sum.meals, co2: sum.co2 }), retailValueCents: sum.value, recipients: recipients.size },
  };
}

export function reportCsv(rows: Awaited<ReturnType<typeof organizationReport>>["rows"]) {
  const header = ["date", "item", "category", "quantity", "unit", "kg_saved", "meals", "co2e_kg", "recipient", "recipient_type", "mode", "retail_value"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.completedAt?.toISOString().slice(0, 10),
      r.listing.title,
      r.listing.category,
      r.quantity,
      r.listing.unit,
      r.kgSaved,
      r.meals,
      r.co2eKg,
      r.claimant.organization?.name ?? "Individual",
      r.claimant.organization?.kind ?? "INDIVIDUAL",
      r.listing.mode,
      ((r.listing.originalPriceCents ?? 0) * r.quantity) / 100,
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

// Public stats are cached in memory for 10 minutes: one query per instance per 10 min.
let publicCache: { at: number; data: Awaited<ReturnType<typeof computePublicImpact>> } | null = null;

export async function publicImpact() {
  if (publicCache && Date.now() - publicCache.at < 600_000) return publicCache.data;
  const data = await computePublicImpact();
  publicCache = { at: Date.now(), data };
  return data;
}

async function computePublicImpact() {
  const [all] = await db.$queryRaw<any[]>`SELECT count(*) rescues, sum("kgSaved") kg, sum(meals) meals, sum("co2eKg") co2 FROM "Claim" WHERE status = 'COMPLETED'`;
  const monthly = await db.$queryRaw<{ month: Date; kg: number; rescues: bigint }[]>`
    SELECT date_trunc('month', "completedAt") AS month, sum("kgSaved")::float AS kg, count(*) AS rescues
    FROM "Claim" WHERE status = 'COMPLETED' AND "completedAt" > now() - interval '12 months'
    GROUP BY 1 ORDER BY 1`;
  const [donors, ngos, volunteers, sponsors] = await Promise.all([
    db.listing.findMany({ distinct: ["ownerId"], select: { ownerId: true }, where: { claims: { some: { status: "COMPLETED" } } } }).then((r) => r.length),
    db.organization.count({ where: { kind: "NGO", verificationStatus: "VERIFIED" } }),
    db.user.count({ where: { isVolunteer: true, status: "ACTIVE" } }),
    db.sponsorship.findMany({ where: { status: "ACTIVE" }, orderBy: { amountCents: "desc" }, take: 24, select: { displayName: true, website: true, message: true, deliveriesFunded: true } }),
  ]);
  return {
    totals: totals(all),
    monthly: monthly.map((m) => ({ month: m.month.toISOString().slice(0, 7), kg: round(m.kg), rescues: Number(m.rescues) })),
    community: { donors, ngos, volunteers },
    sponsors,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
