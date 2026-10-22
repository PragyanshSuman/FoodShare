import type { Metadata } from "next";
import { env } from "@/lib/env";
import { BrowseClient } from "./browse-client";

export const metadata: Metadata = { title: "Find food near you" };

export default function BrowsePage() {
  return <BrowseClient defaultCenter={{ lat: env.defaultLat, lng: env.defaultLng }} />;
}
