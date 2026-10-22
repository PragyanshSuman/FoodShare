import Link from "next/link";
import { adminStats } from "@/lib/services/admin";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Stat } from "@/components/ui";

export default async function AdminHome() {
  const s = await adminStats();
  const c = env.currency;
  const queues = [
    ["Open reports", s.queues.openReports, "/admin/reports"],
    ["Pending verifications", s.queues.pendingVerifications, "/admin/verifications"],
    ["Payout requests", s.queues.pendingPayouts, "/admin/payouts"],
    ["Failed jobs", s.queues.failedJobs, "/api/health"],
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader title="Operations" subtitle="Last 30 days" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {queues.map(([label, n, href]) => (
          <Link key={label} href={href}>
            <Card className={`p-4 ${n > 0 ? "border-accent-500" : ""}`}>
              <div className="text-xs font-medium uppercase text-muted">{label}</div>
              <div className={`mt-1 text-2xl font-bold ${n > 0 ? "text-accent-600" : ""}`}>{n}</div>
            </Card>
          </Link>
        ))}
      </div>
      <h2 className="font-semibold">Marketplace</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={s.users} hint={`+${s.newUsers} new`} />
        <Stat label="Live listings" value={s.activeListings} />
        <Stat label="Claims" value={s.claims30} hint={`${s.completionRate}% completed`} />
        <Stat label="No-shows" value={s.noShows30} />
      </div>
      <h2 className="font-semibold">Revenue</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Surplus GMV" value={formatMoney(s.gmv30, c)} />
        <Stat label="Platform revenue" value={formatMoney(s.revenue30, c)} />
        <Stat label="Rescue Fund balance" value={formatMoney(s.rescueFund, c)} hint="pays volunteer stipends" />
        <Card className="p-4 text-sm">
          <div className="mb-1 text-xs font-medium uppercase text-muted">By source</div>
          {Object.entries(s.revenueByType).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{k.toLowerCase().replace("_", " ")}</span>
              <span className="tabular-nums">{formatMoney(v, c)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
