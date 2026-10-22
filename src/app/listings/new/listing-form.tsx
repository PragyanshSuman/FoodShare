"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { apiFetch, ApiError, uploadFile } from "@/lib/client";
import { CATEGORY_LABEL, DIET_LABEL, STORAGE_LABEL } from "@/lib/format";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { LocationPicker } from "@/components/map-lazy";

type Location = { id: string; label: string; address: string; lat: number; lng: number; city: string | null };
const ALLERGENS = ["gluten", "dairy", "eggs", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame", "mustard"];
const SAFETY_CHECKS = [
  "Cooked and stored hygienically; I would serve this to my own family",
  "Kept hot (above 60 °C) or chilled (below 5 °C) since cooking",
  "Packed in clean, covered containers and labelled",
];
const UNIT_WEIGHT: Record<string, number> = { portions: 0.4, kg: 1, items: 0.25, loaves: 0.5, boxes: 2, trays: 3, litres: 1 };

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const inHours = (h: number) => local(new Date(Date.now() + h * 3600_000));

export function ListingForm({ currency, canSell, isBusiness, locations, home }: { currency: string; canSell: boolean; isBusiness: boolean; locations: Location[]; home: { lat: number; lng: number; city: string | null } }) {
  const router = useRouter();
  const [f, setF] = useState({
    mode: "DONATION",
    title: "",
    description: "",
    category: "PREPARED_MEAL",
    dietType: "VEGETARIAN",
    allergens: [] as string[],
    tags: "",
    quantityTotal: 10,
    unit: "portions",
    weightKgPerUnit: 0.4,
    maxPerClaim: "",
    storage: "AMBIENT",
    preparedAt: inHours(-0.5),
    expiresAt: inHours(8),
    pickupStart: inHours(0),
    pickupEnd: inHours(3),
    price: "",
    originalPrice: "",
    audience: "EVERYONE",
    ngoPriorityMinutes: isBusiness ? 30 : 0,
    requiresApproval: false,
    allowsDelivery: true,
    locationId: locations[0]?.id ?? "",
    address: locations[0]?.address ?? "",
    city: locations[0]?.city ?? home.city ?? "",
    lat: locations[0]?.lat ?? home.lat,
    lng: locations[0]?.lng ?? home.lng,
    pickupInstructions: "",
  });
  const [checks, setChecks] = useState<boolean[]>(SAFETY_CHECKS.map(() => false));
  const [photos, setPhotos] = useState<{ key: string; previewUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const cooked = f.category === "PREPARED_MEAL" || f.storage === "HOT";

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 5 - photos.length)) {
      try {
        const up = await uploadFile(file, "listing");
        setPhotos((p) => [...p, up]);
      } catch (e) {
        setErrors([(e as Error).message]);
      }
    }
  }

  async function findAddress() {
    try {
      const hit = await apiFetch<{ lat: number; lng: number; city: string | null }>(`/api/v1/geocode?q=${encodeURIComponent(f.address)}`);
      setF((s) => ({ ...s, lat: hit.lat, lng: hit.lng, city: hit.city ?? s.city }));
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const toCents = (v: string) => Math.round(Number(v) * 100);
    try {
      const res = await apiFetch("/api/v1/listings", {
        body: {
          ...f,
          tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
          maxPerClaim: f.maxPerClaim ? Number(f.maxPerClaim) : null,
          preparedAt: cooked ? new Date(f.preparedAt).toISOString() : null,
          expiresAt: new Date(f.expiresAt).toISOString(),
          pickupStart: new Date(f.pickupStart).toISOString(),
          pickupEnd: new Date(f.pickupEnd).toISOString(),
          priceCents: f.mode === "SALE" ? toCents(f.price) : 0,
          originalPriceCents: f.originalPrice ? toCents(f.originalPrice) : null,
          locationId: f.locationId || null,
          photoKeys: photos.map((p) => p.key),
          safetyAck: checks.every(Boolean),
          description: f.description || null,
          pickupInstructions: f.pickupInstructions || null,
          city: f.city || null,
        },
      });
      router.push(`/listings/${res.listing.id}`);
    } catch (err) {
      const details = (err as ApiError).details as { violations?: string[] } | undefined;
      setErrors(details?.violations ?? [(err as Error).message]);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {errors.length > 0 && (
        <Notice tone="error">
          <ul className="list-inside list-disc">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">What are you sharing?</h2>
        <Field label="Title">
          <Input required minLength={3} maxLength={100} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 20 portions of veg pulao and dal" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type of food">
            <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Diet">
            <Select value={f.dietType} onChange={(e) => set("dietType", e.target.value)}>
              {Object.entries(DIET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description" hint="Ingredients, how it's packed, anything a recipient should know.">
          <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
        </Field>
        <div>
          <div className="mb-1.5 text-sm font-medium">Contains allergens</div>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => {
              const on = f.allergens.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => set("allergens", on ? f.allergens.filter((x) => x !== a) : [...f.allergens, a])}
                  className={`rounded-full border px-3 py-1 text-sm capitalize ${on ? "border-amber-400 bg-amber-50 font-medium" : "border-line"}`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Tags (optional)" hint="Comma separated: halal, jain, gluten-free, organic…">
          <Input value={f.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>
        <div>
          <div className="mb-1.5 text-sm font-medium">Photos (up to 5)</div>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.key} className="relative">
                <img src={p.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos((ps) => ps.filter((x) => x.key !== p.key))} className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 shadow">
                  <X size={14} />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line text-muted hover:bg-brand-50">
                <ImagePlus size={20} />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">Photos are compressed on your phone before upload.</p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">How much?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quantity">
            <Input type="number" min={1} required value={f.quantityTotal} onChange={(e) => set("quantityTotal", Number(e.target.value))} />
          </Field>
          <Field label="Unit">
            <Select value={f.unit} onChange={(e) => setF((s) => ({ ...s, unit: e.target.value, weightKgPerUnit: UNIT_WEIGHT[e.target.value] ?? s.weightKgPerUnit }))}>
              {Object.keys(UNIT_WEIGHT).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kg per unit" hint="Used for impact reporting">
            <Input type="number" step="0.05" min={0.01} value={f.weightKgPerUnit} onChange={(e) => set("weightKgPerUnit", Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Max per person (optional)" hint="Spreads food across more people">
          <Input type="number" min={1} value={f.maxPerClaim} onChange={(e) => set("maxPerClaim", e.target.value)} className="max-w-40" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Safety & timing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Storage">
            <Select value={f.storage} onChange={(e) => set("storage", e.target.value)}>
              {Object.entries(STORAGE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          {cooked && (
            <Field label="Cooked at">
              <Input type="datetime-local" value={f.preparedAt} onChange={(e) => set("preparedAt", e.target.value)} />
            </Field>
          )}
          <Field label="Pickup from">
            <Input type="datetime-local" required value={f.pickupStart} onChange={(e) => set("pickupStart", e.target.value)} />
          </Field>
          <Field label="Pickup until">
            <Input type="datetime-local" required value={f.pickupEnd} onChange={(e) => set("pickupEnd", e.target.value)} />
          </Field>
          <Field label="Safe to eat until" hint={f.storage === "HOT" ? "Hot food: max 4 h after cooking" : "Best-before / use-by"}>
            <Input type="datetime-local" required value={f.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
          </Field>
        </div>
        {cooked && (
          <fieldset className="space-y-2 rounded-lg bg-canvas p-3">
            <legend className="px-1 text-sm font-medium">Food-safety checklist (required for cooked food)</legend>
            {SAFETY_CHECKS.map((c, i) => (
              <label key={c} className="flex gap-2 text-sm">
                <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((cs) => cs.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-0.5 accent-brand-600" />
                {c}
              </label>
            ))}
            <Link href="/guides/food-safety" target="_blank" className="text-xs font-medium text-brand-700 underline">
              Read the guide
            </Link>
          </fieldset>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Where to collect</h2>
        {locations.length > 0 && (
          <Field label="Your locations">
            <Select
              value={f.locationId}
              onChange={(e) => {
                const loc = locations.find((l) => l.id === e.target.value);
                setF((s) => ({ ...s, locationId: e.target.value, ...(loc ? { address: loc.address, lat: loc.lat, lng: loc.lng, city: loc.city ?? "" } : {}) }));
              }}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} — {l.address}
                </option>
              ))}
              <option value="">Somewhere else…</option>
            </Select>
          </Field>
        )}
        {!f.locationId && (
          <>
            <Field label="Address" hint={isBusiness ? undefined : "Only shown to the person whose pickup you confirm. Others see an approximate area."}>
              <div className="flex gap-2">
                <Input required minLength={5} value={f.address} onChange={(e) => set("address", e.target.value)} />
                <Button type="button" variant="secondary" onClick={findAddress} disabled={f.address.length < 3}>
                  Find
                </Button>
              </div>
            </Field>
            <LocationPicker lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF((s) => ({ ...s, lat, lng }))} />
          </>
        )}
        <Field label="Pickup instructions (optional)">
          <Input value={f.pickupInstructions} onChange={(e) => set("pickupInstructions", e.target.value)} placeholder="e.g. Rear entrance, ask for the duty manager" maxLength={500} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Who can have it</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["DONATION", "Free donation", "Always free for recipients."],
              ["SALE", "Discounted surplus", canSell ? "At least 30% off. You're paid at handover, minus commission." : "Available to verified food businesses."],
            ] as const
          ).map(([mode, label, hint]) => (
            <label key={mode} className={`flex gap-3 rounded-lg border p-3 ${f.mode === mode ? "border-brand-500 bg-brand-50" : "border-line"} ${mode === "SALE" && !canSell ? "opacity-60" : "cursor-pointer"}`}>
              <input type="radio" name="mode" disabled={mode === "SALE" && !canSell} checked={f.mode === mode} onChange={() => setF((s) => ({ ...s, mode, requiresApproval: mode === "SALE" ? false : s.requiresApproval }))} className="mt-1 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {f.mode === "SALE" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Original price per ${f.unit.replace(/s$/, "")} (${currency})`}>
              <Input type="number" min={1} step="0.01" required value={f.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} />
            </Field>
            <Field label={`Your price (${currency})`} hint={f.originalPrice ? `Max ${(Number(f.originalPrice) * 0.7).toFixed(2)}` : undefined}>
              <Input type="number" min={1} step="0.01" required value={f.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
          </div>
        )}
        {f.mode === "DONATION" && isBusiness && (
          <Field label="Retail value per unit (optional)" hint="Shown on your donation certificate for tax / CSR records">
            <Input type="number" min={0} step="0.01" value={f.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} className="max-w-40" />
          </Field>
        )}
        {isBusiness && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience">
              <Select value={f.audience} onChange={(e) => set("audience", e.target.value)}>
                <option value="EVERYONE">Everyone</option>
                <option value="VERIFIED_NGO_ONLY">Verified NGOs only (recommended for large cooked batches)</option>
              </Select>
            </Field>
            <Field label="NGO head start" hint="Verified NGOs can claim before the public">
              <Select value={f.ngoPriorityMinutes} onChange={(e) => set("ngoPriorityMinutes", Number(e.target.value))}>
                {[0, 15, 30, 60, 120].map((m) => (
                  <option key={m} value={m}>
                    {m ? `${m} minutes` : "None"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={f.allowsDelivery} onChange={(e) => set("allowsDelivery", e.target.checked)} className="accent-brand-600" />
          Volunteers may collect on a recipient&apos;s behalf
        </label>
        {f.mode === "DONATION" && (
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={f.requiresApproval} onChange={(e) => set("requiresApproval", e.target.checked)} className="accent-brand-600" />
            I want to approve each request (you must respond within an hour)
          </label>
        )}
      </Card>

      <Button disabled={busy} className="w-full py-3 text-base">
        {busy ? "Publishing…" : "Publish listing"}
      </Button>
    </form>
  );
}
