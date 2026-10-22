import type { Metadata } from "next";
import { publicImpact } from "@/lib/services/impact";
import { IMPACT } from "@/lib/config";
import { formatNumber } from "@/lib/format";
import { ButtonLink, Card, PageHeader, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Live impact" };
export const revalidate = 600;

export default async function ImpactPage() {
  const d = await publicImpact();
  const max = Math.max(1, ...d.monthly.map((m) => m.kg));
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <PageHeader title="Live impact" subtitle="Counted only from handovers confirmed with a code — not from listings posted." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rescues" value={formatNumber(d.totals.rescues)} />
        <Stat label="Food saved" value={`${formatNumber(d.totals.kgSaved)} kg`} />
        <Stat label="Meals" value={formatNumber(d.totals.meals)} />
        <Stat label="CO₂e avoided" value={`${formatNumber(d.totals.co2eKg)} kg`} />
        <Stat label="Water saved" value={`${formatNumber(d.totals.waterLitres / 1000)} m³`} />
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Food saved per month (kg)</h2>
        {d.monthly.length === 0 ? (
          <p className="text-sm text-muted">The first rescues will appear here.</p>
        ) : (
          <div className="flex h-48 items-end gap-2" role="img" aria-label="Monthly kilograms of food saved">
            {d.monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs tabular-nums text-muted">{formatNumber(m.kg)}</span>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${(m.kg / max) * 100}%`, minHeight: 2 }} title={`${m.month}: ${m.kg} kg, ${m.rescues} rescues`} />
                <span className="text-xs text-muted">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Donors with rescues" value={formatNumber(d.community.donors)} />
        <Stat label="Verified NGOs" value={formatNumber(d.community.ngos)} />
        <Stat label="Volunteers" value={formatNumber(d.community.volunteers)} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Rescue Fund sponsors</h2>
            <p className="text-sm text-muted">Their contributions pay volunteer stipends for every delivery.</p>
          </div>
          <ButtonLink href="/sponsor" variant="accent">
            Become a sponsor
          </ButtonLink>
        </div>
        {d.sponsors.length === 0 ? (
          <p className="text-sm text-muted">Be the first.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {d.sponsors.map((s, i) => (
              <Card key={i}>
                <div className="font-semibold">{s.website ? <a href={s.website} rel="nofollow noopener" target="_blank" className="hover:text-brand-700">{s.displayName}</a> : s.displayName}</div>
                <div className="text-sm text-muted">Funded ~{s.deliveriesFunded} deliveries</div>
                {s.message && <p className="mt-2 text-sm italic">&ldquo;{s.message}&rdquo;</p>}
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Methodology: impact = declared weight × conversion factors. {IMPACT.kgPerMeal} kg per meal (food-bank convention), {IMPACT.co2ePerKg} kg CO₂e per kg of food not wasted
        (lifecycle average incl. landfill methane), {IMPACT.waterLitresPerKg} L water per kg (average footprint). Factors are configurable and documented in docs/SCENARIOS.md.
      </p>
    </div>
  );
}
