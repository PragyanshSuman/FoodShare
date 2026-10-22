"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so maps load only in the browser — and only on pages that use them.
const loading = () => <div className="h-full min-h-56 w-full animate-pulse rounded-xl bg-brand-50" />;

export const ListingsMap = dynamic(() => import("./map").then((m) => m.ListingsMap), { ssr: false, loading });
export const LocationPicker = dynamic(() => import("./map").then((m) => m.LocationPicker), { ssr: false, loading });
export const RouteMap = dynamic(() => import("./map").then((m) => m.RouteMap), { ssr: false, loading });
