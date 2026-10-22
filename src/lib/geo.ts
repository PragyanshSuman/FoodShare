const R = 6371; // km

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Index-friendly pre-filter used before the exact haversine distance. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos(toRad(lat)), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/** Round coordinates so public listings never reveal an exact home address. */
export function fuzz(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

const toRad = (d: number) => (d * Math.PI) / 180;
