import Link from "next/link";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CLAIM_STATUS, formatDateTime } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await pageUser("/dashboard/claims");
  const tab = (await searchParams).tab === "donor" ? "donor" : "recipient";
  const claims = await db.claim.findMany({
    where: tab === "donor" ? { listing: { ownerId: user.id } } : { claimantId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { listing: { select: { title: true, unit: true, mode: true } }, claimant: { select: { name: true } } },
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Reservations" />
      <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line sm:w-fit">
        {[
          ["recipient", "Food I reserved"],
          ["donor", "Food I gave"],
        ].map(([k, label]) => (
          <Link key={k} href={`/dashboard/claims?tab=${k}`} className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium ${tab === k ? "bg-brand-600 text-white" : "text-muted"}`}>
            {label}
          </Link>
        ))}
      </div>
      {claims.length === 0 ? (
        <Empty title="Nothing here yet" />
      ) : (
        <Card className="divide-y divide-line p-0">
          {claims.map((c) => (
            <Link key={c.id} href={`/dashboard/claims/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-canvas">
              <div className="min-w-0">
                <div className="truncate font-medium">{c.listing.title}</div>
                <div className="text-xs text-muted">
                  {c.quantity} {c.listing.unit}
                  {tab === "donor" ? ` · ${c.claimant.name}` : ""} · {formatDateTime(c.createdAt)}
                  {c.listing.mode === "SALE" ? " · paid" : ""}
                </div>
              </div>
              <Badge tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
