"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client";
import { ButtonLink, Card, Notice } from "@/components/ui";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | string>("working");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (!token) return setState("This link is missing its token.");
    apiFetch("/api/v1/auth/verify-email", { body: { token } })
      .then(() => setState("ok"))
      .catch((e) => setState(e.message));
  }, [token]);
  return (
    <Card className="space-y-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Email confirmation</h1>
      {state === "working" && <p className="text-muted">Confirming…</p>}
      {state === "ok" && (
        <>
          <Notice tone="success">Your email is confirmed. You can now share and claim food.</Notice>
          <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
        </>
      )}
      {state !== "working" && state !== "ok" && <Notice tone="error">{state} You can request a new link from your dashboard.</Notice>}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
