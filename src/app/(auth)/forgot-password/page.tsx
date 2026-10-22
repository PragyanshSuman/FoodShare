"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Field, Input, Notice } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <div className="mt-4">
          <Notice tone="success">If an account exists for that email, a reset link is on its way. It works for 1 hour.</Notice>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiFetch("/api/v1/auth/forgot-password", { body: { email: new FormData(e.currentTarget).get("email") } });
              setSent(true);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Button className="w-full">Send reset link</Button>
        </form>
      )}
    </Card>
  );
}
