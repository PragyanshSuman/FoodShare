import Link from "next/link";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { entitlementsFor } from "@/lib/services/listings";
import { CATEGORY_LABEL, LISTING_STATUS, formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Badge, ButtonLink, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { ScheduleForm } from "./schedule-form";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function MyListingsPage() {
  const user = await pageUser("/dashboard/listings");
  const ent = entitlementsFor(user);
  const [listings, schedules, locations] = await Promise.all([
    db.listing.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { claims: true } } } }),
    db.recurringSchedule.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }),
    user.organizationId ? db.location.findMany({ where: { organizationId: user.organizationId }, select: { id: true, label: true, address: true, lat: true, lng: true, city: true } }) : [],
  ]);
  const active = listings.filter((l) => ["ACTIVE", "RESERVED"].includes(l.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="My listings" subtitle={`${active} of ${ent.maxActiveListings} active listings on your plan`} action={<ButtonLink href="/listings/new">+ New listing</ButtonLink>} />

      {listings.length === 0 ? (
        <Empty title="No listings yet">Share your first surplus — it takes a minute.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Left</th>
                <th className="px-4 py-3">Pickup ends</th>
                <th className="px-4 py-3">Claims</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/listings/${l.id}`} className="font-medium hover:text-brand-700">
                      {l.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {CATEGORY_LABEL[l.category]} · {l.mode === "SALE" ? "Surplus sale" : "Donation"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={LISTING_STATUS[l.status].tone}>{LISTING_STATUS[l.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {l.quantityAvailable}/{l.quantityTotal}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(l.pickupEnd)}</td>
                  <td className="px-4 py-3 tabular-nums">{l._count.claims}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recurring listings</h2>
        {!ent.recurringListings ? (
          <Notice>
            Post the same surplus automatically every evening (e.g. a bakery&apos;s unsold bread at closing).{" "}
            <Link href="/pricing" className="font-semibold underline">
              Available on Pro
            </Link>
          </Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ScheduleForm locations={locations} />
            </div>
            {schedules.map((s) => {
              const t = s.template as { title?: string };
              return (
                <Card key={s.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="font-medium">{t.title}</div>
                    <Badge tone={s.active ? "green" : "gray"}>{s.active ? "Active" : "Paused"}</Badge>
                  </div>
                  <div className="text-sm text-muted">
                    {s.daysOfWeek.map((d) => DAYS[d]).join(", ")} at {s.publishAt} · next {formatDateTime(s.nextRunAt)}
                  </div>
                  <ActionButton endpoint={`/api/v1/schedules/${s.id}`} method="PATCH" body={{ active: !s.active }}>
                    {s.active ? "Pause" : "Resume"}
                  </ActionButton>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
