import Link from "next/link";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { userImpact } from "@/lib/services/impact";
import { ACTIVE_CLAIM_STATUSES } from "@/lib/domain/claim-state";
import { CLAIM_STATUS, LISTING_STATUS, formatNumber, timeLeft } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Badge, ButtonLink, Card, Empty, Notice, PageHeader, Stat } from "@/components/ui";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await pageUser();
  const { welcome } = await searchParams;
  const [impact, myClaims, incoming, listings] = await Promise.all([
    userImpact(user.id),
    db.claim.findMany({ where: { claimantId: user.id, status: { in: ACTIVE_CLAIM_STATUSES } }, include: { listing: { select: { title: true, pickupEnd: true } } }, orderBy: { createdAt: "desc" } }),
    db.claim.findMany({ where: { listing: { ownerId: user.id }, status: { in: ACTIVE_CLAIM_STATUSES } }, include: { listing: { select: { title: true, unit: true, pickupEnd: true } }, claimant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.listing.findMany({ where: { ownerId: user.id, status: { in: ["ACTIVE", "RESERVED"] } }, orderBy: { pickupEnd: "asc" }, take: 6 }),
  ]);
  const totalMeals = impact.donated.meals + impact.received.meals + impact.delivered.meals;
  const org = user.organization;

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} subtitle="Here's what's happening with your food." action={<ButtonLink href="/listings/new">+ Share food</ButtonLink>} />

      {welcome && <Notice tone="success">Welcome to FoodShare! We&apos;ve sent a confirmation link to {user.email}.</Notice>}
      {!user.emailVerifiedAt && (
        <Notice tone="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Confirm your email to start sharing and claiming food.</span>
            <ActionButton endpoint="/api/v1/auth/resend-verification">Resend link</ActionButton>
          </div>
        </Notice>
      )}
      {user.status === "SUSPENDED" && (
        <Notice tone="error">Claiming is paused until {user.suspendedUntil?.toDateString()} after repeated missed pickups. You can still donate.</Notice>
      )}
      {org && org.verificationStatus !== "VERIFIED" && (
        <Notice>
          {org.verificationStatus === "PENDING" ? "Your verification documents are being reviewed (usually within 2 working days)." : (
            <>
              Verify {org.name} to {org.kind === "NGO" ? "get priority access to new food and higher claim limits" : "sell surplus and earn the verified badge"}.{" "}
              <Link href="/dashboard/organization" className="font-semibold underline">
                Start verification
              </Link>
            </>
          )}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Meals" value={formatNumber(totalMeals)} hint="donated, received or delivered" />
        <Stat label="Food saved" value={`${formatNumber(impact.donated.kgSaved + impact.delivered.kgSaved)} kg`} hint="as donor or volunteer" />
        <Stat label="CO₂e avoided" value={`${formatNumber(impact.donated.co2eKg)} kg`} />
        <Stat label="Rating" value={user.ratingCount ? `${user.ratingAvg}★` : "—"} hint={`${user.ratingCount} reviews`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Pickups from your listings</h2>
          {incoming.length === 0 ? (
            <p className="text-sm text-muted">No open reservations.</p>
          ) : (
            <ul className="divide-y divide-line">
              {incoming.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/dashboard/claims/${c.id}`} className="min-w-0">
                    <div className="truncate font-medium">{c.listing.title}</div>
                    <div className="text-xs text-muted">
                      {c.claimant.name} · {c.quantity} {c.listing.unit} · {timeLeft(c.listing.pickupEnd)}
                    </div>
                  </Link>
                  <Badge tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Your reservations</h2>
          {myClaims.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing reserved. <Link href="/browse" className="font-semibold text-brand-700">Find food nearby →</Link>
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {myClaims.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/dashboard/claims/${c.id}`} className="min-w-0">
                    <div className="truncate font-medium">{c.listing.title}</div>
                    <div className="text-xs text-muted">{timeLeft(c.listing.pickupEnd)}</div>
                  </Link>
                  <Badge tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Live listings</h2>
        {listings.length === 0 ? (
          <Empty title="You have no live listings">Got surplus? It takes about a minute to post.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <Link key={l.id} href={`/dashboard/listings/${l.id}`}>
                <Card className="hover:border-brand-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{l.title}</div>
                    <Badge tone={LISTING_STATUS[l.status].tone}>{LISTING_STATUS[l.status].label}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {l.quantityAvailable}/{l.quantityTotal} {l.unit} left · {timeLeft(l.pickupEnd)}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
