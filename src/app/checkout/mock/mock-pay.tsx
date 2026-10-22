"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui";

export function MockPay({ orderId, back }: { orderId: string; back: string }) {
  const [busy, setBusy] = useState(false);
  const pay = async (outcome: "success" | "failure") => {
    setBusy(true);
    await apiFetch("/api/v1/payments/mock", { body: { orderId, outcome } }).catch(() => {});
    window.location.href = `${back}${outcome === "success" ? (back.includes("?") ? "&" : "?") + "paid=1" : ""}`;
  };
  return (
    <div className="flex gap-2">
      <Button disabled={busy} onClick={() => pay("success")} className="flex-1">
        Simulate success
      </Button>
      <Button disabled={busy} variant="danger" onClick={() => pay("failure")} className="flex-1">
        Simulate failure
      </Button>
    </div>
  );
}
