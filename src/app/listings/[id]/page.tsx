import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, Clock, MapPin, Package, Snowflake, Star, Thermometer } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getListingForViewer } from "@/lib/services/listings";
import { CATEGORY_LABEL, CLAIM_STATUS, DIET_LABEL, LISTING_STATUS, STORAGE_LABEL, formatDateTime, formatWindow, timeLeft } from "@/lib/format";
import { CATEGORY_EMOJI, DietDot, PriceTag } from "@/components/listing-card";
import { Badge, ButtonLink, Card, Notice } from "@/components/ui";
import { ActionButton } from "@/components/actions";
import { ReportButton } from "@/components/report-button";
import { ListingsMap } from "@/components/map-lazy";
import { ClaimPanel } from "./claim-panel";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await getListingForViewer((await params).id, null).catch(() => null);
  return { title: res?.listing.title ?? "Listing" };
}

export default async function ListingPage({ params }: Props) {
  const user = await getCurrentUser();
  const res = await getListingForViewer((await params).id, user);
  if (!res) notFound();
  const { listing: l, myClaim } = res;
  const status = LISTING_STATUS[l.status];
  const priority = l.ngoPriorityUntil && new Date(l.ngoPriorityUntil) > new Date();
  const activeMine = myClaim && ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "IN_DELIVERY"].includes(myClaim.status);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {l.photos.length ? (
            <div className="grid grid-cols-3 gap-1">
              {l.photos.map((p, i) => (
                <img key={p} src={p} alt={`${l.title} photo ${i + 1}`} className={`h-56 w-full object-cover ${i === 0 ? "col-span-3 h-72" : ""}`} />
              ))}
            </div>
          ) : (
            <div className="grid h-56 place-items-center bg-brand-50 text-7xl" aria-hidden>
              {CATEGORY_EMOJI[l.category]}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {l.mode === "SALE" ? <Badge tone="orange">Surplus deal</Badge> : <Badge tone="green">Free donation</Badge>}
            {priority && <Badge tone="blue">NGO priority until {formatDateTime(l.ngoPriorityUntil!)}</Badge>}
            {l.audience === "VERIFIED_NGO_ONLY" && <Badge tone="blue">Verified NGOs only</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{l.title}</h1>
          <div className="mt-2 text-lg">
            <PriceTag l={l} />
          </div>
          {l.description && <p className="mt-4 whitespace-pre-line text-muted">{l.description}</p>}
        </div>

        <Card className="grid gap-4 sm:grid-cols-2">
          <Fact icon={<Package size={18} />} label="Quantity" value={`${l.quantityAvailable} of ${l.quantityTotal} ${l.unit} left${l.maxPerClaim ? ` · max ${l.maxPerClaim} each` : ""}`} />
          <Fact icon={<Clock size={18} />} label="Pickup window" value={`${formatWindow(l.pickupStart, l.pickupEnd)} (${timeLeft(l.pickupEnd)})`} />
          <Fact icon={<DietDot diet={l.dietType} />} label="Food" value={`${CATEGORY_LABEL[l.category]} · ${DIET_LABEL[l.dietType]}`} />
          <Fact
            icon={l.storage === "CHILLED" || l.storage === "FROZEN" ? <Snowflake size={18} /> : <Thermometer size={18} />}
            label="Storage & safety"
            value={`${STORAGE_LABEL[l.storage]} · safe until ${formatDateTime(l.expiresAt)}${l.preparedAt ? ` · cooked ${formatDateTime(l.preparedAt)}` : ""}`}
          />
          <Fact
            icon={<AlertTriangle size={18} />}
            label="Allergens"
            value={l.allergens.length ? l.allergens.join(", ") : "None declared"}
          />
          <Fact icon={<MapPin size={18} />} label="Where" value={l.address ?? `${l.city ?? "Approximate area"} — exact address shared once your pickup is confirmed`} />
        </Card>
        {l.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {l.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
        {l.pickupInstructions && <Notice>Pickup instructions: {l.pickupInstructions}</Notice>}
        <div className="h-64">
          <ListingsMap center={{ lat: l.lat, lng: l.lng }} radiusKm={l.exactLocation ? undefined : 0.6} points={l.exactLocation ? [{ id: l.id, lat: l.lat, lng: l.lng, title: l.title }] : []} />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <div className="text-xs font-medium uppercase text-muted">Shared by</div>
          <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
            {l.donor.name}
            {l.donor.verified && <BadgeCheck size={18} className="text-brand-600" aria-label="Verified" />}
            {l.donor.pro && <Badge tone="green">Pro</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted">
            {l.donor.ratingCount > 0 ? (
              <span className="flex items-center gap-1">
                <Star size={14} className="fill-amber-400 text-amber-400" /> {l.donor.ratingAvg} · {l.donor.ratingCount} reviews
              </span>
            ) : (
              <span>New donor</span>
            )}
            <span>{l.donor.completedCount} rescues</span>
          </div>
        </Card>

        {l.isOwner ? (
          <Card className="space-y-3">
            <p className="font-semibold">This is your listing</p>
            <ButtonLink href={`/dashboard/listings/${l.id}`} className="w-full">
              Manage reservations
            </ButtonLink>
            {["ACTIVE", "RESERVED"].includes(l.status) && (
              <ActionButton endpoint={`/api/v1/listings/${l.id}`} method="DELETE" prompt="Why are you withdrawing it? (claimants will be told and refunded)" variant="danger" className="w-full">
                Withdraw listing
              </ActionButton>
            )}
          </Card>
        ) : activeMine ? (
          <Card className="space-y-3">
            <p className="font-semibold">You have a reservation</p>
            <Badge tone={CLAIM_STATUS[myClaim!.status].tone}>{CLAIM_STATUS[myClaim!.status].label}</Badge>
            <ButtonLink href={`/dashboard/claims/${myClaim!.id}`} className="w-full">
              View pickup details
            </ButtonLink>
          </Card>
        ) : l.status === "ACTIVE" ? (
          user ? (
            <ClaimPanel listing={l} emailVerified={Boolean(user.emailVerifiedAt)} home={user.lat != null && user.lng != null ? { lat: user.lat, lng: user.lng } : null} />
          ) : (
            <Card className="space-y-3">
              <p className="font-semibold">Sign in to reserve</p>
              <p className="text-sm text-muted">It&apos;s free and takes 30 seconds.</p>
              <ButtonLink href={`/login?next=/listings/${l.id}`} className="w-full">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" variant="secondary" className="w-full">
                Create account
              </ButtonLink>
            </Card>
          )
        ) : (
          <Notice tone="warn">This listing is no longer available. <Link href="/browse" className="font-semibold underline">Find other food nearby</Link>.</Notice>
        )}
        {user && !l.isOwner && <ReportButton targetType="LISTING" targetId={l.id} />}
      </aside>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-brand-600">{icon}</div>
      <div>
        <div className="text-xs font-medium uppercase text-muted">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}
