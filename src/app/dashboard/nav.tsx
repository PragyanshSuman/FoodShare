"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

export function DashboardNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <nav className="no-print flex gap-1 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const active = i.href === "/dashboard" ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-100 text-brand-800" : "text-muted hover:bg-white"}`}
          >
            {i.label}
          </Link>
        );
      })}
      <button
        onClick={async () => {
          await apiFetch("/api/v1/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
        className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-muted hover:bg-white md:mt-4"
      >
        Sign out
      </button>
    </nav>
  );
}
