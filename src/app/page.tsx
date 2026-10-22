import Link from "next/link";
import { BadgeCheck, Bike, Building2, HandHeart, KeyRound, Leaf, ShieldCheck, Store, Timer } from "lucide-react";
import { publicImpact } from "@/lib/services/impact";
import { formatNumber } from "@/lib/format";
import { ButtonLink, Card } from "@/components/ui";

export const revalidate = 600; // static page, refreshed every 10 minutes

export default async function Home() {
  const impact = await publicImpact().catch(() => null);
  const t = impact?.totals;
  return (
    <>
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
              <Leaf size={14} /> Surplus food rescue, made routine
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Good food shouldn&apos;t end up in the bin.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Restaurants, bakeries, grocers, caterers and neighbours list surplus in under a minute. NGOs, shelters and people
              nearby collect it — or a volunteer brings it to them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/browse" className="px-6 py-3 text-base">
                Find food near me
              </ButtonLink>
              <ButtonLink href="/listings/new" variant="secondary" className="px-6 py-3 text-base">
                Share surplus
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">Free for donors, NGOs and individuals. Always.</p>
          </div>
          <Card className="self-center p-6">
            <div className="text-sm font-semibold text-muted">Rescued on FoodShare so far</div>
            <div className="mt-4 grid grid-cols-2 gap-5">
              <Metric value={formatNumber(t?.meals ?? 0)} label="meals shared" />
              <Metric value={`${formatNumber(t?.kgSaved ?? 0)} kg`} label="food saved" />
              <Metric value={(t?.co2eKg ?? 0) >= 1000 ? `${formatNumber((t?.co2eKg ?? 0) / 1000)} t` : `${formatNumber(t?.co2eKg ?? 0)} kg`} label="CO₂e avoided" />
              <Metric value={formatNumber(impact?.community.ngos ?? 0)} label="verified NGOs" />
            </div>
            <Link href="/impact" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline">
              See live impact →
            </Link>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">How a rescue works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-4">
          {[
            { icon: Store, title: "1. List it", body: "Snap a photo, set quantity, diet type, allergens and a pickup window. Food-safety rules are checked automatically." },
            { icon: HandHeart, title: "2. Someone reserves", body: "Nearby NGOs get first access, then everyone. Alerts go out instantly — stock can never be double-claimed." },
            { icon: KeyRound, title: "3. Hand over with a code", body: "The collector shows a 6-digit code. You type it in — that's your proof of handover and the impact record." },
            { icon: Bike, title: "4. Or a volunteer delivers", body: "Can't travel? A verified volunteer picks up and drops off, paid a stipend by our sponsors' Rescue Fund." },
          ].map((s) => (
            <Card key={s.title}>
              <s.icon className="text-brand-600" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Built for food businesses</h2>
            <p className="mt-3 text-muted">
              Donate for free, or recover part of your cost by selling end-of-day surplus at 30%+ off. Pro adds recurring listings,
              multi-location and CSR/ESG reports.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                [Building2, "Donation certificates for every rescue — ready for tax and CSR filings"],
                [Timer, "Recurring listings: post tonight's surplus automatically at closing time"],
                [BadgeCheck, "Verified business badge after licence check (e.g. FSSAI)"],
                [ShieldCheck, "You only get paid when food is handed over — no disputes"],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Building2;
                return (
                  <li key={i} className="flex gap-3">
                    <I size={18} className="mt-0.5 shrink-0 text-brand-600" /> {text as string}
                  </li>
                );
              })}
            </ul>
            <ButtonLink href="/pricing" className="mt-6">
              See plans
            </ButtonLink>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Safety is not optional</h2>
            <p className="mt-3 text-muted">The rules are enforced in the product, not just written in the terms.</p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li>• Hot food must be eaten within 4 hours of cooking; pickup always ends before the safe-until time.</li>
              <li>• Cooked food requires a hygiene checklist; allergens are declared and filterable.</li>
              <li>• NGOs and businesses are document-verified before they get priority access or can sell.</li>
              <li>• Three independent food-safety reports pause a listing automatically.</li>
              <li>• Home addresses stay hidden until a pickup is confirmed. Phone numbers too.</li>
              <li>• Repeated no-shows pause claiming, so food goes to people who turn up.</li>
            </ul>
            <ButtonLink href="/guides/food-safety" variant="secondary" className="mt-6">
              Read the food-safety guide
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Fund rescues as a company</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Sponsor the Rescue Fund: every delivery a volunteer completes is paid from it, and your brand appears on our public impact page.
        </p>
        <ButtonLink href="/sponsor" variant="accent" className="mt-6">
          Become a sponsor
        </ButtonLink>
      </section>
    </>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-extrabold tabular-nums text-brand-700">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
