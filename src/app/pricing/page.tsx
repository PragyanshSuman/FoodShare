import type { Metadata } from "next";
import { Check } from "lucide-react";
import { env } from "@/lib/env";
import { PLAN_PRICES, PLANS, PLATFORM } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  const c = env.currency;
  const p = PLAN_PRICES[c] ?? PLAN_PRICES.USD;
  const tiers = [
    {
      name: "Free",
      price: formatMoney(0, c),
      tagline: "For individuals, NGOs and any business getting started",
      cta: ["Start free", "/signup"],
      features: [
        "Unlimited free donations — no fees, ever",
        `${PLANS.FREE.maxActiveListings} active listings at a time`,
        "Donation certificate for every rescue",
        "Volunteer delivery & in-app chat",
        `Sell surplus at ${PLANS.FREE.saleCommissionBps / 100}% commission (verified businesses)`,
      ],
    },
    {
      name: "Pro",
      id: "pro",
      price: `${formatMoney(p.monthly, c)}/mo`,
      sub: `or ${formatMoney(p.yearly, c)}/year`,
      tagline: "For restaurants, bakeries and grocers with daily surplus",
      cta: ["Upgrade in dashboard", "/dashboard/billing"],
      highlight: true,
      features: [
        `${PLANS.PRO.maxActiveListings} active listings`,
        `Lower ${PLANS.PRO.saleCommissionBps / 100}% commission on surplus sales`,
        "Recurring listings (auto-post at closing time)",
        `Up to ${PLANS.PRO.maxLocations} pickup locations`,
        "CSR / ESG impact reports with CSV export",
        "Pro badge on listings",
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      tagline: "Chains, hotel groups, corporate cafeterias, event caterers",
      cta: ["Talk to us", "mailto:partners@foodshare.local"],
      features: [`${PLANS.ENTERPRISE.saleCommissionBps / 100}% commission`, `${PLANS.ENTERPRISE.maxLocations}+ locations`, "Consolidated multi-site reporting", "API access & POS integration", "Dedicated onboarding"],
    },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="Simple, mission-first pricing" subtitle="Donating food is always free. We earn when we help you recover money from surplus, or save you time." />
      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <Card key={t.name} id={t.id} className={`flex flex-col ${t.highlight ? "border-2 border-brand-500" : ""}`}>
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">{t.name}</div>
            <div className="mt-2 text-3xl font-extrabold">{t.price}</div>
            {t.sub && <div className="text-sm text-muted">{t.sub}</div>}
            <p className="mt-2 text-sm text-muted">{t.tagline}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-brand-600" /> {f}
                </li>
              ))}
            </ul>
            <ButtonLink href={t.cta[1]} variant={t.highlight ? "primary" : "secondary"} className="mt-6">
              {t.cta[0]}
            </ButtonLink>
          </Card>
        ))}
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">How surplus sales are paid</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>• Buyers pay upfront (UPI, cards, wallets). Their reservation is held for {PLATFORM.paymentHoldMinutes} minutes.</li>
            <li>• You&apos;re credited at handover — when you type the buyer&apos;s code — minus commission. No-shows are still paid.</li>
            <li>• Withdraw to UPI / bank once you have {formatMoney(PLATFORM.minPayoutCents, c)} or more.</li>
            <li>• If you cancel, the buyer is refunded automatically.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Where the money goes</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>• Commission covers payment fees, hosting, moderation and verification.</li>
            <li>• Sponsorships fund volunteer stipends; we keep a {PLATFORM.sponsorshipFeeBps / 100}% management fee.</li>
            <li>• No ads, no selling data, no fees for NGOs or people receiving food.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
