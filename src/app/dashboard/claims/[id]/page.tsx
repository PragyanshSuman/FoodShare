import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { pageUser } from "@/lib/auth/guards";
import { getClaimForViewer } from "@/lib/services/claims";
import { buyerRefundEligible } from "@/lib/domain/pricing";
import { CLAIM_STATUS, formatDateTime, formatWindow, timeLeft } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ActionButton, CodeEntry } from "@/components/actions";
import { Badge, ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { ReportButton } from "@/components/report-button";
import { RouteMap } from "@/components/map-lazy";
import { Chat } from "./chat";
import { ReviewForm } from "./review-form";

export default async function ClaimPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/dashboard/claims/${id}`);
  const res = await getClaimForViewer(user, id);
  if (!res) notFound();
  const { role, claim } = res;
  const { listing, delivery, order } = claim;
  const st = CLAIM_STATUS[claim.status];
  const active = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "IN_DELIVERY"].includes(claim.status);
  const reviewed = claim.reviews.some((r) => r.authorId === user.id);
  const canReview = !reviewed && (claim.status === "COMPLETED" || (role === "donor" && claim.status === "NO_SHOW")) && (role === "donor" || role === "claimant");
  const counterpart = role === "donor" ? claim.claimant : listing.owner;
  const justPaid = (await searchParams).paid === "1";

  return (
    <div className="space-y-6">
      <PageHeader
        title={listing.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {claim.quantity} {listing.unit} · {claim.fulfilment === "VOLUNTEER_DELIVERY" ? "Volunteer delivery" : "Self pickup"}
          </span>
        }
        action={<ButtonLink href={`/listings/${listing.id}`} variant="secondary">View listing</ButtonLink>}
      />

      {justPaid && claim.status === "PENDING_PAYMENT" && <Notice>Confirming your payment… refresh in a few seconds.</Notice>}
      {claim.status === "PENDING_PAYMENT" && role === "claimant" && (
        <Notice tone="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Complete payment by {claim.holdExpiresAt ? formatDateTime(claim.holdExpiresAt) : "soon"} or the reservation is released.</span>
            <ActionButton endpoint={`/api/v1/claims/${claim.id}/pay`} variant="primary">
              Pay {order ? formatMoney(order.amountCents, order.currency) : ""}
            </ActionButton>
          </div>
        </Notice>
      )}
      {claim.status === "PENDING_APPROVAL" && role === "claimant" && <Notice>The donor is reviewing your request. You&apos;ll be notified within the hour.</Notice>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {/* The core handover step, tailored to who is looking. */}
          {role === "claimant" && claim.status === "CONFIRMED" && claim.pickupCode && (
            <Card className="text-center">
              <div className="text-sm text-muted">Show this code to the donor at pickup</div>
              <div className="my-3 font-mono text-5xl font-bold tracking-[0.25em] text-brand-700">{claim.pickupCode}</div>
              <div className="text-sm">
                {formatWindow(listing.pickupStart, listing.pickupEnd)} · <strong>{timeLeft(listing.pickupEnd)}</strong>
              </div>
            </Card>
          )}
          {role === "claimant" && delivery?.dropCode && (
            <Card className="text-center">
              <div className="text-sm text-muted">Give this code to your volunteer when they arrive</div>
              <div className="my-3 font-mono text-5xl font-bold tracking-[0.25em] text-accent-600">{delivery.dropCode}</div>
              <div className="text-sm text-muted">{delivery.volunteer ? `${delivery.volunteer.name} is on the way` : "Waiting for a volunteer to accept"}</div>
            </Card>
          )}
          {role === "donor" && claim.status === "CONFIRMED" && (
            <Card>
              {claim.fulfilment === "VOLUNTEER_DELIVERY" && delivery?.status !== "ACCEPTED" ? (
                <p className="text-sm text-muted">Waiting for a volunteer to accept this delivery. We&apos;ll notify you.</p>
              ) : (
                <CodeEntry
                  endpoint={`/api/v1/claims/${claim.id}/handover`}
                  label={claim.fulfilment === "VOLUNTEER_DELIVERY" ? `Enter the code shown by volunteer ${delivery?.volunteer?.name ?? ""}` : `Enter ${claim.claimant.name.split(" ")[0]}'s 6-digit code to confirm handover`}
                  cta="Confirm handover"
                />
              )}
            </Card>
          )}
          {role === "volunteer" && delivery && (
            <Card className="space-y-3">
              {delivery.status === "ACCEPTED" && claim.pickupCode && (
                <div className="text-center">
                  <div className="text-sm text-muted">Show the donor this code when collecting</div>
                  <div className="my-2 font-mono text-4xl font-bold tracking-[0.25em] text-brand-700">{claim.pickupCode}</div>
                </div>
              )}
              {delivery.status === "PICKED_UP" && <CodeEntry endpoint={`/api/v1/deliveries/${delivery.id}/drop`} label="Enter the recipient's drop code" cta="Confirm delivery" />}
              <div className="text-sm">
                <div>
                  <strong>Pickup:</strong> {listing.address}
                </div>
                <div>
                  <strong>Drop-off:</strong> {claim.dropAddress}
                </div>
              </div>
            </Card>
          )}
          {claim.status === "COMPLETED" && (
            <Notice tone="success">
              Rescued on {claim.completedAt ? formatDateTime(claim.completedAt) : ""}: {claim.kgSaved} kg of food, about {claim.meals} meals and {claim.co2eKg} kg CO₂e kept out of landfill.{" "}
              {role === "donor" && listing.mode === "DONATION" && (
                <Link href={`/certificates/${claim.id}`} className="font-semibold underline">
                  Download donation certificate
                </Link>
              )}
            </Notice>
          )}
          {claim.status === "NO_SHOW" && <Notice tone="error">This pickup was missed.</Notice>}
          {claim.cancelReason && ["CANCELLED", "REJECTED", "EXPIRED"].includes(claim.status) && <Notice>Reason: {claim.cancelReason}</Notice>}

          {canReview && <ReviewForm claimId={claim.id} subject={role === "donor" ? claim.claimant.name : listing.organization?.name ?? listing.owner.name} />}

          {claim.fulfilment === "VOLUNTEER_DELIVERY" && claim.dropLat != null && claim.dropLng != null && (
            <div className="h-56">
              <RouteMap from={{ lat: listing.lat, lng: listing.lng }} to={{ lat: claim.dropLat, lng: claim.dropLng }} />
            </div>
          )}

          <Chat claimId={claim.id} meId={user.id} closed={["CANCELLED", "REJECTED", "EXPIRED"].includes(claim.status)} />
        </div>

        <aside className="space-y-4">
          <Card className="space-y-2 text-sm">
            <div className="font-semibold">Pickup details</div>
            <div>{formatWindow(listing.pickupStart, listing.pickupEnd)}</div>
            {(role !== "claimant" || ["CONFIRMED", "IN_DELIVERY", "COMPLETED"].includes(claim.status)) && <div>{listing.address}</div>}
            {listing.pickupInstructions && <div className="text-muted">{listing.pickupInstructions}</div>}
            {counterpart.phone && (
              <a href={`tel:${counterpart.phone}`} className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                <Phone size={14} /> Call {role === "donor" ? claim.claimant.name.split(" ")[0] : "donor"}
              </a>
            )}
            {delivery?.volunteer?.phone && role !== "volunteer" && (
              <a href={`tel:${delivery.volunteer.phone}`} className="block font-medium text-brand-700">
                Call volunteer {delivery.volunteer.name.split(" ")[0]}
              </a>
            )}
          </Card>
          {order && (
            <Card className="space-y-1 text-sm">
              <div className="font-semibold">Payment</div>
              <div className="flex justify-between">
                <span>Total</span>
                <span>{formatMoney(order.amountCents, order.currency)}</span>
              </div>
              {role === "donor" && (
                <div className="flex justify-between text-muted">
                  <span>You receive (after commission)</span>
                  <span>{formatMoney(order.payeeAmountCents, order.currency)}</span>
                </div>
              )}
              <Badge tone={order.status === "PAID" ? "green" : order.status === "REFUNDED" ? "gray" : "orange"}>{order.status.toLowerCase()}</Badge>
            </Card>
          )}
          {active && claim.status !== "IN_DELIVERY" && (role === "claimant" || role === "donor") && (
            <ActionButton
              endpoint={`/api/v1/claims/${claim.id}/cancel`}
              prompt={
                role === "claimant" && order?.status === "PAID" && !buyerRefundEligible(listing.pickupEnd)
                  ? "Cancelling this close to pickup is not refunded. Reason:"
                  : "Why are you cancelling? (shared with the other person)"
              }
              variant="danger"
              className="w-full"
            >
              Cancel reservation
            </ActionButton>
          )}
          {role === "volunteer" && delivery?.status === "ACCEPTED" && (
            <ActionButton endpoint={`/api/v1/deliveries/${delivery.id}/release`} confirm="Give this delivery back so another volunteer can take it?" variant="danger" className="w-full">
              I can&apos;t do this delivery
            </ActionButton>
          )}
          <ReportButton targetType="CLAIM" targetId={claim.id} />
        </aside>
      </div>
    </div>
  );
}
