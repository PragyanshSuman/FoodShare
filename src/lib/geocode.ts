import { db } from "./db";
import { env } from "./env";

export type GeoResult = { lat: number; lng: number; displayName: string; city: string | null };

/**
 * Free OpenStreetMap geocoding with a permanent DB cache. Nominatim's policy is
 * ≤1 req/s and no autocomplete — we only geocode on explicit "find" clicks and
 * cache every answer, so repeat addresses never hit the network again.
 */
export async function geocode(rawQuery: string): Promise<GeoResult | null> {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (query.length < 3) return null;

  const cached = await db.geocodeCache.findUnique({ where: { query } });
  if (cached) return cached;

  const url = new URL(env.geocoderUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": `FoodShare/1.0 (${env.geocoderContact})`, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!res?.ok) return null;

  const [hit] = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: Record<string, string>;
  }>;
  if (!hit) return null;

  const a = hit.address ?? {};
  const result: GeoResult = {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    displayName: hit.display_name,
    city: a.city ?? a.town ?? a.village ?? a.state_district ?? null,
  };
  await db.geocodeCache.create({ data: { query, ...result } }).catch(() => {});
  return result;
}
