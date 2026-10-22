"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, uploadFile } from "@/lib/client";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { LocationPicker } from "@/components/map-lazy";

type Org = {
  name: string;
  category: string;
  description: string | null;
  website: string | null;
  phone: string | null;
  registrationNumber: string | null;
  taxExemptId: string | null;
  payoutDetails: string | null;
};

function useSubmit() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "success", text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, run };
}

export function OrgForm({ org, isNgo }: { org: Org | null; isNgo: boolean }) {
  const { msg, busy, run } = useSubmit();
  return (
    <Card>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = Object.fromEntries(new FormData(e.currentTarget));
          run(() => apiFetch("/api/v1/organization", { method: "PATCH", body: fd }), "Saved");
        }}
      >
        <Field label="Name">
          <Input name="name" required defaultValue={org?.name} />
        </Field>
        <Field label="Category">
          <Input name="category" required defaultValue={org?.category ?? (isNgo ? "shelter" : "restaurant")} />
        </Field>
        <Field label={isNgo ? "NGO registration no. (Trust / Society / Sec. 8)" : "Food licence no. (e.g. FSSAI)"} hint="Changing this after verification sends you back for review">
          <Input name="registrationNumber" defaultValue={org?.registrationNumber ?? ""} />
        </Field>
        <Field label={isNgo ? "Tax exemption (80G / 12A / 501(c)(3))" : "GST / tax ID (optional)"}>
          <Input name="taxExemptId" defaultValue={org?.taxExemptId ?? ""} />
        </Field>
        <Field label="Public phone">
          <Input name="phone" defaultValue={org?.phone ?? ""} />
        </Field>
        <Field label="Website">
          <Input name="website" type="url" defaultValue={org?.website ?? ""} />
        </Field>
        <Field label="About" className="sm:col-span-2">
          <Textarea name="description" defaultValue={org?.description ?? ""} />
        </Field>
        {!isNgo && (
          <Field label="Payout details (UPI ID / bank ref)" hint="Used for surplus sale payouts" className="sm:col-span-2">
            <Input name="payoutDetails" defaultValue={org?.payoutDetails ?? ""} />
          </Field>
        )}
        <div className="sm:col-span-2">
          {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
          <Button disabled={busy}>{org ? "Save changes" : "Create organisation"}</Button>
        </div>
      </form>
    </Card>
  );
}

export function LocationForm({ defaultLat, defaultLng }: { defaultLat: number; defaultLng: number }) {
  const { msg, busy, run } = useSubmit();
  const [pos, setPos] = useState({ lat: defaultLat, lng: defaultLng });
  const [address, setAddress] = useState("");
  return (
    <form
      className="space-y-3 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => apiFetch("/api/v1/organization/locations", { body: { label: fd.get("label"), address, city: fd.get("city") || null, ...pos, isDefault: fd.get("isDefault") === "on" } }), "Location added");
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Label">
          <Input name="label" required placeholder="Main kitchen" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input required minLength={5} value={address} onChange={(e) => setAddress(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const hit = await apiFetch<{ lat: number; lng: number }>(`/api/v1/geocode?q=${encodeURIComponent(address)}`).catch(() => null);
                if (hit) setPos(hit);
              }}
            >
              Find
            </Button>
          </div>
        </Field>
      </div>
      <Field label="City">
        <Input name="city" className="max-w-xs" />
      </Field>
      <LocationPicker lat={pos.lat} lng={pos.lng} onChange={(lat, lng) => setPos({ lat, lng })} />
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="isDefault" className="accent-brand-600" /> Make default
      </label>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Button disabled={busy} variant="secondary">
        Add location
      </Button>
    </form>
  );
}

export function VerificationForm({ isNgo, hasRegistration }: { isNgo: boolean; hasRegistration: boolean }) {
  const { msg, busy, run } = useSubmit();
  const [docs, setDocs] = useState<{ docType: string; fileKey: string; name: string }[]>([]);
  const [docType, setDocType] = useState(isNgo ? "registration_certificate" : "fssai_licence");
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Get verified</h2>
      <p className="text-sm text-muted">
        {isNgo
          ? "Upload your registration certificate (and 80G/12A if you have it). Verified NGOs get first access to new food and higher limits."
          : "Upload your food licence (FSSAI registration/licence in India). Verified businesses can sell surplus and show the verified badge."}{" "}
        Documents are stored privately and only seen by our review team.
      </p>
      {!hasRegistration && <Notice tone="warn">Add your registration / licence number above first.</Notice>}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Document type">
          <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="registration_certificate">Registration certificate</option>
            <option value="fssai_licence">Food licence (FSSAI)</option>
            <option value="tax_exemption">Tax exemption (80G / 12A)</option>
            <option value="id_proof">ID of signatory</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <label className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand-50">
          Choose file
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const up = await uploadFile(file, "verification");
              setDocs((d) => [...d, { docType, fileKey: up.key, name: file.name }]);
            }}
          />
        </label>
      </div>
      {docs.length > 0 && (
        <ul className="text-sm">
          {docs.map((d) => (
            <li key={d.fileKey}>
              ✓ {d.name} <span className="text-muted">({d.docType.replace(/_/g, " ")})</span>
            </li>
          ))}
        </ul>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Button
        disabled={busy || docs.length === 0 || !hasRegistration}
        onClick={() => run(() => apiFetch("/api/v1/organization/verification", { body: { documents: docs.map(({ docType, fileKey }) => ({ docType, fileKey })) } }), "Submitted for review")}
      >
        Submit for verification
      </Button>
    </Card>
  );
}
