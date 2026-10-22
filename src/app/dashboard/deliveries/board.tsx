"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bike, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { timeLeft } from "@/lib/format";
import { Badge, Button, Card, Empty } from "@/components/ui";

type Open = { id: string; title: string; quantity: string; area: string | null; tripKm: number; awayKm: number; pickupBy: string; estStipendCents: number };
type Mine = { id: string; claimId: string; status: string; title: string; quantity: string; pickupAddress: string; dropAddress: string | null; pickupBy: string; pickupCode: string | null; tripKm: number; stipendCents: number | null };

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "INR";

export function DeliveriesBoard() {
  const [data, setData] = useState<{ open: Open[]; mine: Mine[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ open: Open[]; mine: Mine[] }>("/api/v1/deliveries").then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function accept(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/v1/deliveries/${id}/accept`, { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-white" />;
  const current = data.mine.filter((m) => ["ACCEPTED", "PICKED_UP"].includes(m.status));
  const past = data.mine.filter((m) => !["ACCEPTED", "PICKED_UP"].includes(m.status));

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-700">{error}</p>}
      {current.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">In progress</h2>
          <div className="space-y-3">
            {current.map((m) => (
              <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-sm text-muted">{m.status === "ACCEPTED" ? `Collect from ${m.pickupAddress}` : `Deliver to ${m.dropAddress}`}</div>
                  {m.pickupCode && <div className="mt-1 text-sm">Pickup code: <span className="font-mono font-bold">{m.pickupCode}</span></div>}
                </div>
                <Link href={`/dashboard/claims/${m.claimId}`} className="text-sm font-semibold text-brand-700">
                  Open →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Open near you</h2>
        {data.open.length === 0 ? (
          <Empty title="No deliveries needed right now">We&apos;ll send you a notification when someone nearby needs help.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.open.map((t) => (
              <Card key={t.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{t.title}</div>
                  {t.estStipendCents > 0 && <Badge tone="green">~{formatMoney(t.estStipendCents, CURRENCY)}</Badge>}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted">
                  <span>{t.quantity}</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {t.awayKm} km away{t.area ? ` · ${t.area}` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bike size={13} /> {t.tripKm} km trip
                  </span>
                </div>
                <div className="text-sm font-medium text-accent-600">Collect within {timeLeft(t.pickupBy)}</div>
                <Button onClick={() => accept(t.id)} className="w-full">
                  I&apos;ll deliver this
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">History</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {past.map((m) => (
              <div key={m.id} className="flex justify-between px-4 py-2.5">
                <span>{m.title}</span>
                <span className="text-muted">
                  {m.status.toLowerCase()}
                  {m.stipendCents ? ` · ${formatMoney(m.stipendCents, CURRENCY)}` : ""}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
