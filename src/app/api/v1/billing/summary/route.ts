import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { ACCOUNTS, availableBalance, balanceOf } from "@/lib/services/billing";
import { entitlementsFor } from "@/lib/services/listings";

export const GET = api(async () => {
  const user = await requireUser();
  const account = ACCOUNTS.user(user.id);
  const [balance, available, ledger, orders, payouts] = await Promise.all([
    balanceOf(account),
    availableBalance(user.id),
    db.ledgerEntry.findMany({ where: { account }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return {
    plan: user.organization?.plan ?? "FREE",
    planRenewsAt: user.organization?.planRenewsAt ?? null,
    entitlements: entitlementsFor(user),
    balance,
    available,
    ledger,
    orders,
    payouts,
  };
});
