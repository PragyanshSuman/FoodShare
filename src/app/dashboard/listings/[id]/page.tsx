import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CLAIM_STATUS, LISTING_STATUS, formatDateTime, formatWindow } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Badge, ButtonLink, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { ExtendForm } from "./extend-form";

export default async function ManageListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/dashboard/listings/${id}`);
  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      claims: {
        orderBy: { createdAt: "desc" },
        include: { claimant: { select: { name: true, ratingAvg: true, ratingCount: true, completedCount: true, noShowStrikes: true, organization: { select: { name: true, verificationStatus: true } } } } },
      },
    },
  });
  if (!listing || listing.ownerId !== user.id) notFound();
  const open = ["ACTIVE", "RESERVED"].includes(listing.status);
  const reserved = listing.quantityTotal - listing.quantityAvailable;

  return (
    <div className="space-y-6">
      <PageHeader
        title={listing.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={LISTING_STATUS[listing.status].tone}>{LISTING_STATUS[listing.status].label}</Badge>
            {formatWindow(listing.pickupStart, listing.pickupEnd)}
          </span>
        }
        action={
          <div className="flex gap-2">
            <ButtonLink href={`/listings/${listing.id}`} variant="secondary">
              Public page
            </ButtonLink>
            {open && (
              <ActionButton endpoint={`/api/v1/listings/${listing.id}`} method="DELETE" prompt="Reason for withdrawing (shared with claimants):" variant="danger">
                Withdraw
              </ActionButton>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Available" value={listing.quantityAvailable} hint={listing.unit} />
        <Stat label="Reserved / collected" value={reserved} hint={listing.unit} />
        <Stat label="Views" value={listing.viewCount} />
      </div>

      {open && <ExtendForm listingId={listing.id} pickupEnd={listing.pickupEnd.toISOString()} expiresAt={listing.expiresAt.toISOString()} quantityTotal={listing.quantityTotal} />}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Reservations</h2>
        {listing.claims.length === 0 ? (
          <Empty title="No reservations yet">We&apos;ve alerted people nearby who asked to hear about food like this.</Empty>
        ) : (
          <div className="space-y-3">
            {listing.claims.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.claimant.organization?.name ?? c.claimant.name}</span>
                    {c.claimant.organization?.verificationStatus === "VERIFIED" && <Badge tone="blue">Verified NGO</Badge>}
                    <Badge tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {c.quantity} {listing.unit} · {c.fulfilment === "VOLUNTEER_DELIVERY" ? "Volunteer delivery" : "Self pickup"} · {formatDateTime(c.createdAt)} ·{" "}
                    {c.claimant.completedCount} pickups{c.claimant.ratingCount ? `, ${c.claimant.ratingAvg}★` : ""}
                    {c.claimant.noShowStrikes > 0 ? ` · ${c.claimant.noShowStrikes} missed` : ""}
                  </div>
                  {c.note && <div className="mt-1 text-sm italic">&ldquo;{c.note}&rdquo;</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status === "PENDING_APPROVAL" && (
                    <>
                      <ActionButton endpoint={`/api/v1/claims/${c.id}/approve`} body={{ approve: true }} variant="primary">
                        Approve
                      </ActionButton>
                      <ActionButton endpoint={`/api/v1/claims/${c.id}/approve`} body={{ approve: false }} prompt="Reason (optional, shared with them):">
                        Decline
                      </ActionButton>
                    </>
                  )}
                  <ButtonLink href={`/dashboard/claims/${c.id}`} variant="secondary">
                    {c.status === "CONFIRMED" ? "Hand over" : "Details"}
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-muted">
        Need to change something else? Withdraw and re-post — or <Link href="/guides/how-it-works" className="underline">read how editing works</Link>.
      </p>
    </div>
  );
}
