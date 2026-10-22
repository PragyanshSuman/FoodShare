import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
  accent: "bg-accent-500 text-white hover:bg-accent-600",
  secondary: "bg-white text-ink border border-line hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};
const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={clsx(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-xl border border-line bg-white p-5", className)} {...props} />;
}

const tones = {
  green: "bg-brand-100 text-brand-800",
  orange: "bg-orange-100 text-orange-800",
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
};
export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export const Input = ({ className, ...p }: ComponentProps<"input">) => <input className={clsx(field, className)} {...p} />;
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => <textarea className={clsx(field, "min-h-24", className)} {...p} />;
export const Select = ({ className, ...p }: ComponentProps<"select">) => <select className={clsx(field, className)} {...p} />;

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const t = { info: "bg-sky-50 border-sky-200 text-sky-900", warn: "bg-amber-50 border-amber-200 text-amber-900", error: "bg-red-50 border-red-200 text-red-900", success: "bg-brand-50 border-brand-200 text-brand-900" }[tone];
  return <div className={clsx("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}
