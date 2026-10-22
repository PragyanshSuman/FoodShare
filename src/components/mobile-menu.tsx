"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-brand-50">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-16 border-b border-line bg-white px-4 py-2 shadow-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium hover:bg-brand-50">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
