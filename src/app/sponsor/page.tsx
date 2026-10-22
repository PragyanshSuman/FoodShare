import type { Metadata } from "next";
import { env } from "@/lib/env";
import { PLATFORM } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth/session";
import { ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { SponsorForm } from "./sponsor-form";

export const metadata: Metadata = { title: "Sponsor rescues" };

export default async function SponsorPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const user = await getCurrentUser();
  const { paid } = await searchParams;
  const per = PLATFORM.sponsorCostPerDeliveryCents;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Sponsor the Rescue Fund" subtitle="Turn your CSR budget into measurable meals. Every volunteer delivery is paid from this fund." />
      {paid && <div className="mb-6"><Notice tone="success">Thank you! Your sponsorship is now live on the impact page.</Notice></div>}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-2xl font-bold">{formatMoney(per, env.currency)}</div>
          <div className="text-sm text-muted">funds one volunteer delivery</div>
        </Card>
        <Card>
          <div className="text-2xl font-bold">{100 - PLATFORM.sponsorshipFeeBps / 100}%</div>
          <div className="text-sm text-muted">goes straight to stipends</div>
        </Card>
        <Card>
          <div className="text-2xl font-bold">Public</div>
          <div className="text-sm text-muted">recognition on the impact page</div>
        </Card>
      </div>
      {user ? <SponsorForm currency={env.currency} perDelivery={per} defaultName={user.organization?.name ?? user.name} /> : (
        <Card className="space-y-3 text-center">
          <p>Sign in to sponsor — we issue an invoice to your account.</p>
          <ButtonLink href="/login?next=/sponsor">Sign in</ButtonLink>
        </Card>
      )}
    </div>
  );
}
