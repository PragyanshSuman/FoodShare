"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors";

// CSS-only pins: no marker image assets to break under bundling.
const pin = (color: string, label = "") =>
  L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font:700 11px system-ui">${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string; tone?: "green" | "orange" };

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function ListingsMap({ center, radiusKm, points }: { center: { lat: number; lng: number }; radiusKm?: number; points: MapPoint[] }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom={false} className="h-full min-h-72 w-full">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <Recenter lat={center.lat} lng={center.lng} />
      {radiusKm && <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ color: "#1f8048", weight: 1, fillOpacity: 0.04 }} />}
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p.tone === "orange" ? "#e8833a" : "#1f8048")}>
          <Popup>
            <strong>{p.title}</strong>
            {p.subtitle && <div>{p.subtitle}</div>}
            {p.href && (
              <a href={p.href} style={{ color: "#1f8048", fontWeight: 600 }}>
                View →
              </a>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Tap the map to drop a pin; drag to fine-tune. */
export function LocationPicker({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} className="h-64 w-full">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <Recenter lat={lat} lng={lng} />
      <ClickToSet onPick={onChange} />
      <Marker
        position={[lat, lng]}
        draggable
        icon={pin("#1f8048")}
        eventHandlers={{ dragend: (e) => onChange((e.target as L.Marker).getLatLng().lat, (e.target as L.Marker).getLatLng().lng) }}
      />
    </MapContainer>
  );
}

export function RouteMap({ from, to }: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }) {
  const bounds = L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]).pad(0.3);
  return (
    <MapContainer bounds={bounds} className="h-56 w-full" scrollWheelZoom={false}>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <Marker position={[from.lat, from.lng]} icon={pin("#1f8048", "P")} />
      <Marker position={[to.lat, to.lng]} icon={pin("#e8833a", "D")} />
    </MapContainer>
  );
}
