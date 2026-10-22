"use client";

import { useCallback, useEffect, useState } from "react";
import { BellPlus, LocateFixed, Search } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client";
import { CATEGORY_LABEL, DIET_LABEL } from "@/lib/format";
import type { ListingView } from "@/lib/services/listings";
import { ListingCard } from "@/components/listing-card";
import { ListingsMap } from "@/components/map-lazy";
import { Button, Empty, Input, Select } from "@/components/ui";

type Filters = { q: string; category: string; diet: string; mode: string; radiusKm: string; excludeAllergens: string };
const ALLERGENS = ["gluten", "dairy", "eggs", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame"];

export function BrowseClient({ defaultCenter }: { defaultCenter: { lat: number; lng: number } }) {
  const [center, setCenter] = useState(defaultCenter);
  const [filters, setFilters] = useState<Filters>({ q: "", category: "", diet: "", mode: "", radiusKm: "5", excludeAllergens: "" });
  const [items, setItems] = useState<ListingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng) });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    try {
      const res = await apiFetch<{ items: ListingView[] }>(`/api/v1/listings?${qs}`);
      setItems(res.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [center, filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    // Use the browser's location once if the user allows it.
    navigator.geolocation?.getCurrentPosition((p) => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 5000 });
  }, []);

  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const toggleAllergen = (a: string) =>
    setFilters((f) => {
      const list = f.excludeAllergens ? f.excludeAllergens.split(",") : [];
      return { ...f, excludeAllergens: (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]).join(",") };
    });

  async function saveAlert() {
    try {
      await apiFetch("/api/v1/me/alerts", {
        body: {
          label: filters.category ? CATEGORY_LABEL[filters.category] : "Near me",
          lat: center.lat,
          lng: center.lng,
          radiusKm: Number(filters.radiusKm),
          categories: filters.category ? [filters.category] : [],
          dietTypes: filters.diet ? [filters.diet] : [],
          modes: filters.mode ? [filters.mode] : [],
        },
      });
      setAlertMsg("Alert saved — we'll notify you when matching food is posted.");
    } catch (e) {
      setAlertMsg((e as ApiError).status === 401 ? "Sign in to save alerts." : (e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Food available near you</h1>
          <p className="text-sm text-muted">Free donations and discounted surplus, closest first.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }))}>
            <LocateFixed size={16} /> Use my location
          </Button>
          <Button variant="secondary" onClick={saveAlert}>
            <BellPlus size={16} /> Alert me
          </Button>
        </div>
      </div>
      {alertMsg && <p className="mb-3 text-sm text-brand-700">{alertMsg}</p>}

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <Input placeholder="Search bread, biryani, fruit…" value={filters.q} onChange={set("q")} className="pl-9" />
        </div>
        <Select value={filters.category} onChange={set("category")} aria-label="Category">
          <option value="">All food types</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={filters.diet} onChange={set("diet")} aria-label="Diet">
          <option value="">Any diet</option>
          {Object.entries(DIET_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {k === "NON_VEGETARIAN" ? "Everything" : `${v} only`}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Select value={filters.mode} onChange={set("mode")} aria-label="Price">
            <option value="">All</option>
            <option value="DONATION">Free</option>
            <option value="SALE">Deals</option>
          </Select>
          <Select value={filters.radiusKm} onChange={set("radiusKm")} aria-label="Distance" className="w-28">
            {["2", "5", "10", "25"].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 text-muted">Avoid:</span>
        {ALLERGENS.map((a) => {
          const on = filters.excludeAllergens.split(",").includes(a);
          return (
            <button
              key={a}
              onClick={() => toggleAllergen(a)}
              className={`rounded-full border px-2.5 py-1 capitalize ${on ? "border-red-300 bg-red-50 text-red-800" : "border-line bg-white text-muted hover:bg-brand-50"}`}
            >
              {on ? "✕ " : ""}
              {a}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex gap-1 md:hidden">
        {(["list", "map"] as const).map((v) => (
          <Button key={v} variant={view === v ? "primary" : "secondary"} onClick={() => setView(v)} className="flex-1 capitalize">
            {v}
          </Button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <div className={`space-y-3 ${view === "map" ? "hidden md:block" : ""}`}>
          {error && <Empty title="Couldn't load listings">{error}</Empty>}
          {!error && items === null && [1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />)}
          {items?.length === 0 && (
            <Empty title="Nothing nearby right now">Try a wider radius, or save an alert and we&apos;ll tell you the moment something is posted.</Empty>
          )}
          {items?.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
        <div className={`h-[70vh] md:sticky md:top-20 ${view === "list" ? "hidden md:block" : ""}`}>
          <ListingsMap
            center={center}
            radiusKm={Number(filters.radiusKm)}
            points={(items ?? []).map((l) => ({
              id: l.id,
              lat: l.lat,
              lng: l.lng,
              title: l.title,
              subtitle: `${l.quantityAvailable} ${l.unit} · ${l.donor.name}`,
              href: `/listings/${l.id}`,
              tone: l.mode === "SALE" ? "orange" : "green",
            }))}
          />
        </div>
      </div>
    </div>
  );
}
