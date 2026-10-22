import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { availableBalance } from "@/lib/services/billing";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ActionButton } from "@/components/actions";
import { Card, Empty, PageHeader } from "@/components/ui";

export default async function PayoutsPage() {
  const me = await getCurrentUser();
  if (me?.role !== "ADMIN") redirect("/admin");
  const payouts = await db.payout.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, organization: { select: { name: true } } } } },
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Payout requests" subtitle="Send the money by UPI / bank transfer, then record the reference here. Manual transfers cost nothing; switch to RazorpayX / Stripe Connect when volume justifies it." />
      {payouts.length === 0 && <Empty title="Nothing to pay out" />}
      {await Promise.all(
        payouts.map(async (p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">
                {formatMoney(p.amountCents, p.currency)} → <span className="font-mono">{p.destination}</span>
              </div>
              <div className="text-sm text-muted">
                {p.user.organization?.name ?? p.user.name} ({p.user.email}) · requested {formatDateTime(p.createdAt)} · balance after other requests{" "}
                {formatMoney(await availableBalance(p.user.id), p.currency)}
              </div>
            </div>
            <div className="flex gap-2">
              <ActionButton endpoint={`/api/v1/admin/payouts/${p.id}`} body={{ approve: true }} prompt="Transfer reference (UTR / transaction id):" promptField="reference" variant="primary">
                Mark paid
              </ActionButton>
              <ActionButton endpoint={`/api/v1/admin/payouts/${p.id}`} body={{ approve: false }} prompt="Reason for rejecting:" promptField="note" variant="danger">
                Reject
              </ActionButton>
            </div>
          </Card>
        )),
      )}
    </div>
  );
}
