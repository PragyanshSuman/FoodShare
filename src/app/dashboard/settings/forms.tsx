"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { LocationPicker } from "@/components/map-lazy";

type Profile = {
  name: string;
  phone: string | null;
  city: string | null;
  lat: number;
  lng: number;
  isVolunteer: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
  emailDigest: boolean;
};

export function ProfileForm({ user }: { user: Profile }) {
  const router = useRouter();
  const [p, setP] = useState(user);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (k: "isVolunteer" | "notifyEmail" | "notifyPush" | "emailDigest") => (
    <input type="checkbox" checked={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} className="accent-brand-600" />
  );
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiFetch("/api/v1/me", { method: "PATCH", body: { ...p, phone: p.phone || null, city: p.city || null } });
            setMsg("Saved");
            router.refresh();
          } catch (err) {
            setMsg((err as Error).message);
          }
        }}
      >
        <h2 className="font-semibold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name">
            <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required />
          </Field>
          <Field label="Phone" hint="Only shared with people you have a confirmed pickup with">
            <Input value={p.phone ?? ""} onChange={(e) => setP({ ...p, phone: e.target.value })} />
          </Field>
          <Field label="City / area">
            <Input value={p.city ?? ""} onChange={(e) => setP({ ...p, city: e.target.value })} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium">Home area</div>
          <p className="mb-2 text-xs text-muted">Used to sort food by distance and to match you with volunteer deliveries. Never shown publicly.</p>
          <LocationPicker lat={p.lat} lng={p.lng} onChange={(lat, lng) => setP({ ...p, lat, lng })} />
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex gap-2">{toggle("isVolunteer")} I volunteer for deliveries</label>
          <label className="flex gap-2">{toggle("notifyEmail")} Email me about my pickups and listings</label>
          <label className="flex gap-2">{toggle("emailDigest")} Send food alerts as one daily email</label>
          <label className="flex gap-2">{toggle("notifyPush")} Browser push notifications</label>
        </div>
        {msg && <Notice tone={msg === "Saved" ? "success" : "error"}>{msg}</Notice>}
        <Button>Save</Button>
      </form>
    </Card>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.register("/sw.js").then(async (reg) => setState((await reg.pushManager.getSubscription()) ? "on" : "off"));
  }, [vapidKey]);

  if (state === "unsupported") return <p className="text-sm text-muted">Not available in this browser{vapidKey ? "" : " (push keys not configured)"}.</p>;
  if (state === "denied") return <p className="text-sm text-muted">Notifications are blocked in your browser settings.</p>;
  return (
    <Button
      variant="secondary"
      disabled={state === "loading"}
      onClick={async () => {
        const reg = await navigator.serviceWorker.ready;
        if (state === "on") {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await apiFetch("/api/v1/me/push", { method: "DELETE", body: { endpoint: sub.endpoint } });
            await sub.unsubscribe();
          }
          return setState("off");
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        await apiFetch("/api/v1/me/push", { body: sub.toJSON() });
        setState("on");
      }}
    >
      {state === "on" ? "Turn off on this device" : "Turn on for this device"}
    </Button>
  );
}
