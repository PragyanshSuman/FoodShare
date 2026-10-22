"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, goToCheckout } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type { ListingView } from "@/lib/services/listings";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { LocationPicker } from "@/components/map-lazy";

const TIP_PRESETS = [0, 1000, 2000, 5000];

export function ClaimPanel({ listing: l, emailVerified, home }: { listing: ListingView; emailVerified: boolean; home: { lat: number; lng: number } | null }) {
  const router = useRouter();
  const max = Math.min(l.quantityAvailable, l.maxPerClaim ?? l.quantityAvailable);
  const [quantity, setQuantity] = useState(1);
  const [fulfilment, setFulfilment] = useState<"SELF_PICKUP" | "VOLUNTEER_DELIVERY">("SELF_PICKUP");
  const [drop, setDrop] = useState(home ?? { lat: l.lat, lng: l.lng });
  const [dropAddress, setDropAddress] = useState("");
  const [note, setNote] = useState("");
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subtotal = l.priceCents * quantity;

  if (!emailVerified) return <Notice tone="warn">Confirm your email address to reserve food. Check your inbox, or resend it from your dashboard.</Notice>;

  async function geocode() {
    try {
      const hit = await apiFetch<{ lat: number; lng: number }>(`/api/v1/geocode?q=${encodeURIComponent(dropAddress)}`);
      setDrop({ lat: hit.lat, lng: hit.lng });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/listings/${l.id}/claims`, {
        body: {
          quantity,
          fulfilment,
          note: note || null,
          tipCents: l.mode === "SALE" ? tip : 0,
          ...(fulfilment === "VOLUNTEER_DELIVERY" ? { dropAddress, dropLat: drop.lat, dropLng: drop.lng } : {}),
        },
      });
      if (res.checkout) return goToCheckout(res.checkout);
      router.push(`/dashboard/claims/${res.claim.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <p className="font-semibold">{l.mode === "SALE" ? "Buy this surplus" : "Reserve this food"}</p>
      <Field label={`How many ${l.unit}?`} hint={`Up to ${max}. Please take only what you'll use.`}>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Less">
            −
          </Button>
          <Input type="number" min={1} max={max} value={quantity} onChange={(e) => setQuantity(Math.min(max, Math.max(1, Number(e.target.value) || 1)))} className="w-20 text-center" />
          <Button type="button" variant="secondary" onClick={() => setQuantity((q) => Math.min(max, q + 1))} aria-label="More">
            +
          </Button>
        </div>
      </Field>

      {l.allowsDelivery && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">How will you get it?</legend>
          {(
            [
              ["SELF_PICKUP", "I'll collect it", "Show your 6-digit code at pickup."],
              ["VOLUNTEER_DELIVERY", "Volunteer delivery", "A nearby volunteer brings it to you (up to 15 km). Not guaranteed."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${fulfilment === value ? "border-brand-500 bg-brand-50" : "border-line"}`}>
              <input type="radio" name="fulfilment" checked={fulfilment === value} onChange={() => setFulfilment(value)} className="mt-1 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {fulfilment === "VOLUNTEER_DELIVERY" && (
        <div className="space-y-2">
          <Field label="Delivery address">
            <div className="flex gap-2">
              <Input value={dropAddress} onChange={(e) => setDropAddress(e.target.value)} placeholder="Building, street, area" />
              <Button type="button" variant="secondary" onClick={geocode} disabled={dropAddress.length < 3}>
                Find
              </Button>
            </div>
          </Field>
          <p className="text-xs text-muted">Tap the map to set the exact drop point.</p>
          <LocationPicker lat={drop.lat} lng={drop.lng} onChange={(lat, lng) => setDrop({ lat, lng })} />
        </div>
      )}

      <Field label="Note for the donor (optional)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Collecting for a shelter of 40 people" className="min-h-16" />
      </Field>

      {l.mode === "SALE" && (
        <div className="space-y-2 rounded-lg bg-canvas p-3 text-sm">
          <div className="flex justify-between">
            <span>
              {quantity} × {formatMoney(l.priceCents, l.currency)}
            </span>
            <span>{formatMoney(subtotal, l.currency)}</span>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">Add a tip to keep FoodShare free for NGOs (optional)</div>
            <div className="flex gap-1.5">
              {TIP_PRESETS.map((t) => (
                <button key={t} type="button" onClick={() => setTip(t)} className={`rounded-md border px-2.5 py-1 text-xs ${tip === t ? "border-brand-500 bg-brand-50 font-semibold" : "border-line bg-white"}`}>
                  {t ? formatMoney(t, l.currency) : "No tip"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <span>Total</span>
            <span>{formatMoney(subtotal + tip, l.currency)}</span>
          </div>
          <p className="text-xs text-muted">Held for 15 minutes while you pay. Full refund if the seller cancels, or if you cancel at least 1 hour before pickup closes.</p>
        </div>
      )}

      {l.requiresApproval && <Notice>The donor reviews requests for this listing and has an hour to respond.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Button onClick={submit} disabled={busy} className="w-full py-3">
        {busy ? "Reserving…" : l.mode === "SALE" ? `Pay ${formatMoney(subtotal + tip, l.currency)}` : l.requiresApproval ? "Request food" : "Reserve now"}
      </Button>
    </Card>
  );
}
