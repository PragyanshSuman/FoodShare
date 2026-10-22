"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Textarea } from "@/components/ui";

const TAGS = ["On time", "Friendly", "Fresh food", "Well packed", "As described", "Easy to find"];

export function ReviewForm({ claimId, subject }: { claimId: string; subject: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="space-y-3">
      <div className="font-semibold">How was it with {subject}?</div>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
            <Star size={28} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map((t) => (
          <button key={t} type="button" onClick={() => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))} className={`rounded-full border px-2.5 py-1 text-xs ${tags.includes(t) ? "border-brand-500 bg-brand-50" : "border-line"}`}>
            {t}
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything to add? (optional)" maxLength={500} className="min-h-16" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button
        disabled={!rating}
        onClick={async () => {
          try {
            await apiFetch(`/api/v1/claims/${claimId}/review`, { body: { rating, tags, comment: comment || null } });
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Submit review
      </Button>
    </Card>
  );
}
