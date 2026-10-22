"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Field, Input } from "@/components/ui";

const local = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Edits that stay safe while people hold reservations: more time, more stock. */
export function ExtendForm({ listingId, pickupEnd, expiresAt, quantityTotal }: { listingId: string; pickupEnd: string; expiresAt: string; quantityTotal: number }) {
  const router = useRouter();
  const [end, setEnd] = useState(local(pickupEnd));
  const [qty, setQty] = useState(quantityTotal);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          try {
            await apiFetch(`/api/v1/listings/${listingId}`, { method: "PATCH", body: { pickupEnd: new Date(end).toISOString(), quantityTotal: qty } });
            setMsg("Saved");
            router.refresh();
          } catch (err) {
            setMsg((err as Error).message);
          }
        }}
      >
        <Field label="Pickup until" hint={`Food is safe until ${new Date(expiresAt).toLocaleString()}`}>
          <Input type="datetime-local" value={end} max={local(expiresAt)} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Total quantity">
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-28" />
        </Field>
        <Button variant="secondary">Update</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </form>
    </Card>
  );
}
