import Link from "next/link";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PLAN_PRICES, PLATFORM } from "@/lib/config";
import { ACCOUNTS, availableBalance, balanceOf } from "@/lib/services/billing";
import { entitlementsFor } from "@/lib/services/listings";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ActionButton } from "@/components/actions";
import { Badge, Card, Notice, PageHeader, Stat } from "@/components/ui";
import { PayoutForm } from "./payout-form";

const LEDGER_LABEL: Record<string, string> = { SALE_CREDIT: "Surplus sale", STIPEND: "Delivery stipend", PAYOUT: "Payout", REFUND: "Refund reversal" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const user = await pageUser("/dashboard/billing");
  const { paid } = await searchParams;
  const account = ACCOUNTS.user(user.id);
  const [balance, available, ledger, orders, payouts] = await Promise.all([
    balanceOf(account),
    availableBalance(user.id),
    db.ledgerEntry.findMany({ where: { account }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const org = user.organization;
  const ent = entitlementsFor(user);
  const prices = PLAN_PRICES[env.currency] ?? PLAN_PRICES.USD;
  const c = env.currency;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & payouts" />
      {paid && <Notice tone="success">Payment received — thank you! It may take a few seconds to show.</Notice>}

      {org?.kind === "BUSINESS" && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                Plan: <Badge tone={org.plan === "FREE" ? "gray" : "green"}>{org.plan}</Badge>
              </div>
              <div className="text-sm text-muted">
                {org.plan === "FREE"
                  ? `${ent.maxActiveListings} active listings · ${ent.saleCommissionBps / 100}% commission on sales`
                  : `Renews / ends ${org.planRenewsAt ? formatDateTime(org.planRenewsAt) : "—"} · ${ent.saleCommissionBps / 100}% commission`}
              </div>
            </div>
            <div className="flex gap-2">
              <ActionButton endpoint="/api/v1/billing/subscribe" body={{ period: "monthly" }} variant={org.plan === "FREE" ? "primary" : "secondary"}>
                {org.plan === "FREE" ? "Upgrade" : "Renew"} · {formatMoney(prices.monthly, c)}/mo
              </ActionButton>
              <ActionButton endpoint="/api/v1/billing/subscribe" body={{ period: "yearly" }}>
                {formatMoney(prices.yearly, c)}/yr (2 months free)
              </ActionButton>
            </div>
          </div>
          <p className="text-xs text-muted">
            Pro is prepaid (no auto-debit mandates) — we remind you 3 days before it ends. <Link href="/pricing" className="underline">Compare plans</Link>
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Balance" value={formatMoney(balance, c)} hint="sales + stipends − payouts" />
        <Stat label="Available to withdraw" value={formatMoney(available, c)} hint={`min ${formatMoney(PLATFORM.minPayoutCents, c)}`} />
        <Stat label="Pending payouts" value={payouts.filter((p) => p.status === "REQUESTED").length} />
      </div>

      {available >= PLATFORM.minPayoutCents && <PayoutForm max={available} currency={c} defaultDestination={org?.payoutDetails ?? ""} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Earnings ledger</h2>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted">Sales are credited when food is handed over; volunteer stipends when a delivery completes.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {ledger.map((e) => (
                <li key={e.id} className="flex justify-between py-2">
                  <span>
                    {LEDGER_LABEL[e.type] ?? e.type}
                    <span className="block text-xs text-muted">
                      {formatDateTime(e.createdAt)}
                      {e.memo ? ` · ${e.memo}` : ""}
                    </span>
                  </span>
                  <span className={`tabular-nums ${e.amountCents < 0 ? "text-red-700" : "text-brand-700"}`}>{formatMoney(e.amountCents, e.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Your payments</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex justify-between py-2">
                  <span>
                    {{ LISTING_PURCHASE: "Surplus purchase", SUBSCRIPTION: "Pro plan", SPONSORSHIP: "Sponsorship", PLATFORM_TIP: "Support FoodShare" }[o.kind]}
                    <span className="block text-xs text-muted">{formatDateTime(o.createdAt)}</span>
                  </span>
                  <span className="text-right">
                    {formatMoney(o.amountCents, o.currency)}
                    <span className="block text-xs text-muted">{o.status.toLowerCase()}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Keep FoodShare free for NGOs</div>
          <div className="text-sm text-muted">We have no ads. Small contributions pay for servers, SMS-free alerts and moderation.</div>
        </div>
        <div className="flex gap-2">
          {(c === "INR" ? [10_000, 50_000] : [500, 2_000]).map((a) => (
            <ActionButton key={a} endpoint="/api/v1/billing/tip" body={{ amountCents: a }}>
              Give {formatMoney(a, c)}
            </ActionButton>
          ))}
        </div>
      </Card>
    </div>
  );
}
