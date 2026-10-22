"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client";
import { CATEGORY_LABEL, DIET_LABEL } from "@/lib/format";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Loc = { id: string; label: string; address: string; lat: number; lng: number; city: string | null };

/** Pro: auto-post the same surplus on chosen weekdays (e.g. bakery closing time). */
export function ScheduleForm({ locations }: { locations: Loc[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (!locations.length) return <Notice>Add a pickup location under Organisation to create recurring listings.</Notice>;
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + New recurring listing
      </Button>
    );
  return (
    <Card>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const loc = locations.find((l) => l.id === fd.get("locationId"))!;
          const windowH = Number(fd.get("windowHours"));
          const category = String(fd.get("category"));
          try {
            await apiFetch("/api/v1/schedules", {
              body: {
                listing: {
                  title: fd.get("title"),
                  category,
                  dietType: fd.get("dietType"),
                  quantityTotal: Number(fd.get("quantity")),
                  unit: fd.get("unit"),
                  storage: "AMBIENT",
                  locationId: loc.id,
                  address: loc.address,
                  city: loc.city,
                  lat: loc.lat,
                  lng: loc.lng,
                  safetyAck: true,
                  ngoPriorityMinutes: 30,
                },
                daysOfWeek: days,
                publishAt: fd.get("publishAt"),
                pickupStartMin: 0,
                pickupEndMin: windowH * 60,
                expiresMin: Math.max(windowH * 60 + 60, category === "PREPARED_MEAL" ? 6 * 60 : 12 * 60),
                tzOffsetMin: -new Date().getTimezoneOffset(),
              },
            });
            setMsg({ tone: "success", text: "Schedule created" });
            setOpen(false);
            router.refresh();
          } catch (err) {
            setMsg({ tone: "error", text: (err as Error).message });
          }
        }}
      >
        <Field label="Title" className="sm:col-span-2">
          <Input name="title" required minLength={3} placeholder="Unsold bread & pastries" />
        </Field>
        <Field label="Type">
          <Select name="category" defaultValue="BAKERY">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Diet">
          <Select name="dietType">
            {Object.entries(DIET_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Typical quantity">
          <Input name="quantity" type="number" min={1} defaultValue={10} />
        </Field>
        <Field label="Unit">
          <Input name="unit" defaultValue="items" />
        </Field>
        <Field label="Location">
          <Select name="locationId">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Post at">
            <Input name="publishAt" type="time" defaultValue="20:00" required />
          </Field>
          <Field label="Pickup window (h)">
            <Input name="windowHours" type="number" min={1} max={12} defaultValue={2} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1.5 text-sm font-medium">Days</div>
          <div className="flex gap-1">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => setDays((ds) => (ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i]))} className={`rounded-md border px-2.5 py-1 text-sm ${days.includes(i) ? "border-brand-500 bg-brand-50 font-semibold" : "border-line"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted sm:col-span-2">Cooked food is marked as prepared at posting time; by enabling this you confirm the food-safety checklist applies every time.</p>
        {msg && <div className="sm:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        <div className="flex gap-2 sm:col-span-2">
          <Button disabled={!days.length}>Create schedule</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
