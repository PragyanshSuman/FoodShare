"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, ButtonLink, Card, Field, Input, Notice } from "@/components/ui";

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done)
    return (
      <Card className="space-y-4 p-6">
        <Notice tone="success">Password updated. For safety, you've been signed out on all devices.</Notice>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiFetch("/api/v1/auth/reset-password", { body: { token, password: new FormData(e.currentTarget).get("password") } });
            setDone(true);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="New password" hint="At least 8 characters">
          <Input name="password" type="password" minLength={8} required autoComplete="new-password" />
        </Field>
        <Button className="w-full">Update password</Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
