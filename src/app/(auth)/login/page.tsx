"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Field, Input, Notice } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="p-6">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to share or collect food.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            await apiFetch("/api/v1/auth/login", { body: { email: fd.get("email"), password: fd.get("password") } });
            router.push(next);
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Create account
        </Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
