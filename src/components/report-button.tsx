"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Select, Textarea } from "./ui";

const REASONS = [
  ["FOOD_SAFETY", "Food safety concern (spoiled, unsafe, mislabelled allergens)"],
  ["MISREPRESENTED", "Not as described"],
  ["NO_SHOW", "Didn't show up"],
  ["HARASSMENT", "Rude or abusive behaviour"],
  ["FRAUD", "Scam or fraud"],
  ["OTHER", "Something else"],
] as const;

export function ReportButton({ targetType, targetId }: { targetType: "LISTING" | "USER" | "CLAIM"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("FOOD_SAFETY");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");

  if (state === "done") return <p className="text-sm text-muted">Thanks — our team will review this. Food-safety reports are looked at first.</p>;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-muted hover:text-red-700">
        <Flag size={14} /> Report a problem
      </button>
    );
  return (
    <Card className="space-y-3">
      <Select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
        {REASONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened?" maxLength={1000} />
      {state !== "idle" && state !== "busy" && <p className="text-sm text-red-700">{state}</p>}
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            try {
              await apiFetch("/api/v1/reports", { body: { targetType, targetId, reason, details: details || null } });
              setState("done");
            } catch (e) {
              setState((e as Error).message);
            }
          }}
        >
          Send report
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
