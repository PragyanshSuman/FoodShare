import Link from "next/link";
import { BadgeCheck, Clock, MapPin, Star } from "lucide-react";
import type { ListingView } from "@/lib/services/listings";
import { CATEGORY_LABEL, DIET_LABEL, timeLeft } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Badge } from "./ui";

export const CATEGORY_EMOJI: Record<string, string> = {
  PREPARED_MEAL: "🍛",
  BAKERY: "🥐",
  PRODUCE: "🥦",
  DAIRY: "🧀",
  PACKAGED: "🥫",
  BEVERAGES: "🧃",
  GROCERY: "🛒",
  MIXED: "🧺",
};

export function DietDot({ diet }: { diet: string }) {
  // Indian FSSAI convention: green = veg, brown = non-veg.
  const color = diet === "NON_VEGETARIAN" ? "#8b3a1e" : diet === "EGGETARIAN" ? "#d4a017" : "#1f8048";
  return (
    <span title={DIET_LABEL[diet]} className="inline-grid h-4 w-4 place-items-center rounded-sm border-2" style={{ borderColor: color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function PriceTag({ l }: { l: Pick<ListingView, "mode" | "priceCents" | "originalPriceCents" | "currency" | "discountPercent"> }) {
  if (l.mode === "DONATION") return <span className="font-bold text-brand-700">Free</span>;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-bold">{formatMoney(l.priceCents, l.currency)}</span>
      {l.originalPriceCents && <span className="text-xs text-muted line-through">{formatMoney(l.originalPriceCents, l.currency)}</span>}
      {l.discountPercent > 0 && <Badge tone="orange">−{l.discountPercent}%</Badge>}
    </span>
  );
}

export function ListingCard({ l }: { l: ListingView }) {
  const priority = l.ngoPriorityUntil && new Date(l.ngoPriorityUntil) > new Date();
  return (
    <Link href={`/listings/${l.id}`} className="group flex overflow-hidden rounded-xl border border-line bg-white transition hover:border-brand-200 hover:shadow-sm">
      <div className="relative grid w-28 shrink-0 place-items-center bg-brand-50 text-4xl sm:w-36">
        {l.photos[0] ? <img src={l.photos[0]} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span aria-hidden>{CATEGORY_EMOJI[l.category]}</span>}
        {l.mode === "SALE" && <span className="absolute left-2 top-2 rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Deal</span>}
      </div>
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold group-hover:text-brand-700">{l.title}</h3>
          <PriceTag l={l} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <DietDot diet={l.dietType} /> {CATEGORY_LABEL[l.category]}
          </span>
          <span>
            {l.quantityAvailable} {l.unit} left
          </span>
          {l.distanceKm != null && (
            <span className="flex items-center gap-0.5">
              <MapPin size={12} /> {l.distanceKm} km
            </span>
          )}
          <span className="flex items-center gap-0.5 font-medium text-accent-600">
            <Clock size={12} /> {timeLeft(l.pickupEnd)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-medium">
            {l.donor.name}
            {l.donor.verified && <BadgeCheck size={14} className="text-brand-600" aria-label="Verified" />}
          </span>
          {l.donor.ratingCount > 0 && (
            <span className="flex items-center gap-0.5 text-muted">
              <Star size={12} className="fill-amber-400 text-amber-400" /> {l.donor.ratingAvg} ({l.donor.ratingCount})
            </span>
          )}
          {priority && <Badge tone="blue">NGO priority</Badge>}
          {l.allowsDelivery && <Badge tone="gray">Delivery possible</Badge>}
        </div>
      </div>
    </Link>
  );
}
