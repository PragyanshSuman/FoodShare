"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, HandHeart, User } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";

const TYPES = [
  { value: "INDIVIDUAL", icon: User, title: "Individual", body: "Share home surplus, collect food, or volunteer." },
  { value: "BUSINESS", icon: Building2, title: "Food business", body: "Restaurant, bakery, grocer, caterer, hotel, event venue." },
  { value: "NGO", icon: HandHeart, title: "NGO / shelter", body: "Food bank, shelter, community kitchen or fridge." },
] as const;

const CATEGORIES = {
  BUSINESS: ["restaurant", "bakery", "grocery", "caterer", "hotel", "cafeteria", "event_venue", "farm", "other"],
  NGO: ["food_bank", "shelter", "community_kitchen", "community_fridge", "orphanage", "old_age_home", "other"],
};

export default function SignupPage() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("INDIVIDUAL");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="p-6">
      <h1 className="text-2xl font-bold">Join FoodShare</h1>
      <p className="mt-1 text-sm text-muted">Free forever for donors, NGOs and individuals.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            await apiFetch("/api/v1/auth/signup", {
              body: {
                name: fd.get("name"),
                email: fd.get("email"),
                password: fd.get("password"),
                accountType: type,
                isVolunteer: fd.get("isVolunteer") === "on",
                organizationName: type === "INDIVIDUAL" ? undefined : fd.get("organizationName"),
                organizationCategory: type === "INDIVIDUAL" ? undefined : fd.get("organizationCategory"),
                acceptTerms: fd.get("acceptTerms") === "on",
              },
            });
            router.push("/dashboard?welcome=1");
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid gap-2">
          {TYPES.map((t) => (
            <label key={t.value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${type === t.value ? "border-brand-500 bg-brand-50" : "border-line"}`}>
              <input type="radio" className="sr-only" checked={type === t.value} onChange={() => setType(t.value)} />
              <t.icon size={20} className="mt-0.5 text-brand-600" />
              <span>
                <span className="block text-sm font-semibold">{t.title}</span>
                <span className="block text-xs text-muted">{t.body}</span>
              </span>
            </label>
          ))}
        </div>
        <Field label="Your name">
          <Input name="name" required minLength={2} autoComplete="name" />
        </Field>
        {type !== "INDIVIDUAL" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === "NGO" ? "Organisation name" : "Business name"}>
              <Input name="organizationName" required minLength={2} />
            </Field>
            <Field label="Type">
              <Select name="organizationCategory">
                {CATEGORIES[type].map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="isVolunteer" className="accent-brand-600" /> I&apos;d also like to volunteer for deliveries
        </label>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="acceptTerms" required className="accent-brand-600" />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="text-brand-700 underline" target="_blank">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/guides/food-safety" className="text-brand-700 underline" target="_blank">
              food-safety guidelines
            </Link>
          </span>
        </label>
        <Button disabled={busy} className="w-full">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
