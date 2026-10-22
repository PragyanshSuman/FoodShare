import type { Metadata } from "next";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PageHeader, Notice } from "@/components/ui";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = { title: "Share food" };

export default async function NewListingPage() {
  const user = await pageUser("/listings/new");
  const locations = user.organizationId ? await db.location.findMany({ where: { organizationId: user.organizationId }, orderBy: { isDefault: "desc" } }) : [];
  const org = user.organization;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Share surplus food" subtitle="Takes about a minute. Everything here helps recipients decide safely." />
      {!user.emailVerifiedAt && (
        <div className="mb-6">
          <Notice tone="warn">Confirm your email before posting — check your inbox for the link.</Notice>
        </div>
      )}
      <ListingForm
        currency={env.currency}
        canSell={org?.kind === "BUSINESS" && org.verificationStatus === "VERIFIED"}
        isBusiness={org?.kind === "BUSINESS"}
        locations={locations.map((l) => ({ id: l.id, label: l.label, address: l.address, lat: l.lat, lng: l.lng, city: l.city }))}
        home={{ lat: user.lat ?? env.defaultLat, lng: user.lng ?? env.defaultLng, city: user.city }}
      />
    </div>
  );
}
