"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { Button, Card, Field, Input } from "@/components/ui";

export function PayoutForm({ max, currency, defaultDestination }: { max: number; currency: string; defaultDestination: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState((max / 100).toFixed(2));
  const [destination, setDestination] = useState(defaultDestination);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiFetch("/api/v1/billing/payouts", { body: { amountCents: Math.round(Number(amount) * 100), destination } });
            setMsg("Requested — payouts are sent within 3 working days.");
            router.refresh();
          } catch (err) {
            setMsg((err as Error).message);
          }
        }}
      >
        <Field label={`Amount (max ${formatMoney(max, currency)})`}>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" />
        </Field>
        <Field label="Send to (UPI ID or bank reference)">
          <Input required value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="name@upi" />
        </Field>
        <Button>Request payout</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </form>
    </Card>
  );
}
