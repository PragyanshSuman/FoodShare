"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { apiFetch, goToCheckout } from "@/lib/client";
import { Button, Input } from "./ui";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

/**
 * Calls an API endpoint then refreshes the server-rendered page. Covers most
 * dashboard actions (approve, cancel, accept delivery…) without per-action code.
 */
export function ActionButton({
  endpoint,
  method = "POST",
  body,
  confirm,
  prompt,
  promptField = "reason",
  children,
  variant = "secondary",
  redirectTo,
  className,
}: {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
  confirm?: string;
  prompt?: string;
  promptField?: string;
  children: ReactNode;
  variant?: Variant;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    let payload = body ?? {};
    if (prompt) {
      const value = window.prompt(prompt);
      if (value === null) return;
      payload = { ...payload, [promptField]: value };
    } else if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      const res = await apiFetch(endpoint, { method, body: payload });
      if (res?.checkout) return goToCheckout(res.checkout);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant={variant} onClick={run} disabled={busy} className={className}>
        {busy ? "Working…" : children}
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

/** Six-digit handover code entry (donor at pickup, volunteer at drop-off). */
export function CodeEntry({ endpoint, label, cta }: { endpoint: string; label: string; cta: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await apiFetch(endpoint, { body: { code } });
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="max-w-40 text-center font-mono text-lg tracking-[0.3em]"
        />
        <Button disabled={busy || code.length !== 6}>{busy ? "Checking…" : cta}</Button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
