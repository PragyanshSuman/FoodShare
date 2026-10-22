import Link from "next/link";
import { pageUser } from "@/lib/auth/guards";
import { entitlementsFor } from "@/lib/services/listings";
import { organizationReport, userImpact } from "@/lib/services/impact";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { env } from "@/lib/env";
import { ButtonLink, Card, Notice, PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await pageUser("/dashboard/impact");
  const sp = await searchParams;
  const impact = await userImpact(user.id);
  const org = user.organization;
  const ent = entitlementsFor(user);
  const to = sp.to ? new Date(sp.to) : new Date();
  const from = sp.from ? new Date(sp.from) : new Date(to.getTime() - 90 * 86_400_000);
  const report = org && ent.csrReports ? await organizationReport(org.id, from, to) : null;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Your impact" subtitle="Calculated from completed handovers only — every number is backed by a verified code entry." />
      <Section title="As a donor" t={impact.donated} />
      <Section title="As a recipient" t={impact.received} />
      {user.isVolunteer && <Section title="As a volunteer" t={impact.delivered} />}

      {org?.kind === "BUSINESS" && (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">CSR / ESG report — {org.name}</h2>
            {report && (
              <form className="flex flex-wrap items-end gap-2 text-sm">
                <label>
                  From <input type="date" name="from" defaultValue={iso(from)} className="rounded border border-line px-2 py-1" />
                </label>
                <label>
                  To <input type="date" name="to" defaultValue={iso(to)} className="rounded border border-line px-2 py-1" />
                </label>
                <button className="rounded bg-white px-3 py-1 ring-1 ring-line">Apply</button>
                <ButtonLink href={`/api/v1/impact/report?from=${iso(from)}&to=${iso(to)}`} variant="secondary">
                  CSV
                </ButtonLink>
                <PrintButton />
              </form>
            )}
          </div>
          {!report ? (
            <Notice>
              Board-ready CSR/ESG reports with date ranges, recipient breakdowns and CSV export are part of{" "}
              <Link href="/pricing" className="font-semibold underline">
                FoodShare Pro
              </Link>
              . Individual donation certificates stay free.
            </Notice>
          ) : (
            <Card className="space-y-4">
              <p className="text-sm text-muted">
                {org.name} · {iso(from)} to {iso(to)} · Methodology: {"weight × impact factors (0.5 kg/meal, 2.5 kg CO₂e/kg)"}
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat label="Rescues" value={report.summary.rescues} />
                <Stat label="Food" value={`${formatNumber(report.summary.kgSaved)} kg`} />
                <Stat label="Meals" value={formatNumber(report.summary.meals)} />
                <Stat label="CO₂e" value={`${formatNumber(report.summary.co2eKg)} kg`} />
                <Stat label="Retail value" value={formatMoney(report.summary.retailValueCents, env.currency)} hint={`${report.summary.recipients} recipients`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">Date</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Kg</th>
                      <th>Recipient</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2">{r.completedAt?.toISOString().slice(0, 10)}</td>
                        <td>{r.listing.title}</td>
                        <td>
                          {r.quantity} {r.listing.unit}
                        </td>
                        <td>{r.kgSaved}</td>
                        <td>{r.claimant.organization?.name ?? "Individual"}</td>
                        <td className="no-print">
                          {r.listing.mode === "DONATION" && (
                            <Link href={`/certificates/${r.id}`} className="text-brand-700">
                              Certificate
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, t }: { title: string; t: { rescues: number; kgSaved: number; meals: number; co2eKg: number; waterLitres: number } }) {
  return (
    <div>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rescues" value={t.rescues} />
        <Stat label="Food" value={`${formatNumber(t.kgSaved)} kg`} />
        <Stat label="Meals" value={formatNumber(t.meals)} />
        <Stat label="CO₂e avoided" value={`${formatNumber(t.co2eKg)} kg`} hint={`≈ ${formatNumber(t.waterLitres / 1000)} m³ water`} />
      </div>
    </div>
  );
}
