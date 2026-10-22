"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Input } from "@/components/ui";

type Msg = { id: string; body: string; createdAt: string; sender: { id: string; name: string } };

/** Lightweight polling chat: every 10 s while visible. Phone numbers stay private. */
export function Chat({ claimId, meId, closed }: { claimId: string; meId: string; closed: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await apiFetch<{ messages: Msg[] }>(`/api/v1/claims/${claimId}/messages`).catch(() => null);
      if (alive && r) setMessages(r.messages);
    };
    load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [claimId]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

  return (
    <Card className="space-y-3">
      <div className="font-semibold">Messages</div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-muted">Coordinate pickup details here.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender.id === meId ? "justify-end" : ""}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender.id === meId ? "bg-brand-600 text-white" : "bg-canvas"}`}>
              {m.sender.id !== meId && <div className="text-xs font-semibold opacity-70">{m.sender.name.split(" ")[0]}</div>}
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {!closed && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setError(null);
            try {
              const { message } = await apiFetch<{ message: Msg }>(`/api/v1/claims/${claimId}/messages`, { body: { body: text } });
              setMessages((ms) => [...ms, { ...message, sender: { id: meId, name: "You" } }]);
              setText("");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Running 5 minutes late…" maxLength={1000} />
          <Button aria-label="Send">
            <Send size={16} />
          </Button>
        </form>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </Card>
  );
}
