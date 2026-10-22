"use client";

import { useState } from "react";
import { apiFetch, goToCheckout } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { Button, Card, Field, Input, Notice } from "@/components/ui";

export function SponsorForm({ currency, perDelivery, defaultName }: { currency: string; perDelivery: number; defaultName: string }) {
  const presets = [10, 50, 200, 1000];
  const [deliveries, setDeliveries] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = deliveries * perDelivery;
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            const res = await apiFetch("/api/v1/billing/sponsor", {
              body: { amountCents: amount, displayName: fd.get("displayName"), message: fd.get("message") || null, website: fd.get("website") || null },
            });
            await goToCheckout(res.checkout);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <div>
          <div className="mb-2 text-sm font-medium">How many deliveries?</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setDeliveries(p)} className={`rounded-lg border px-4 py-2 text-sm ${deliveries === p ? "border-brand-500 bg-brand-50 font-semibold" : "border-line"}`}>
                {p} · {formatMoney(p * perDelivery, currency)}
              </button>
            ))}
            <Input type="number" min={1} value={deliveries} onChange={(e) => setDeliveries(Math.max(1, Number(e.target.value)))} className="w-28" aria-label="Custom number of deliveries" />
          </div>
        </div>
        <Field label="Name shown publicly">
          <Input name="displayName" required minLength={2} defaultValue={defaultName} />
        </Field>
        <Field label="Website (optional)">
          <Input name="website" type="url" placeholder="https://" />
        </Field>
        <Field label="Message (optional)">
          <Input name="message" maxLength={200} placeholder="Proud to fight food waste in our city" />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button disabled={busy} variant="accent" className="w-full py-3">
          Sponsor {formatMoney(amount, currency)}
        </Button>
      </form>
    </Card>
  );
}
