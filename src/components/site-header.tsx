import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/guards";
import { ButtonLink } from "./ui";
import { NotificationBell } from "./notification-bell";
import { MobileMenu } from "./mobile-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const links = [
    { href: "/browse", label: "Find food" },
    { href: "/listings/new", label: "Share food" },
    { href: "/impact", label: "Impact" },
    { href: "/pricing", label: "For business" },
  ];
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <Logo /> FoodShare
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-brand-50 hover:text-brand-800">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {isStaff(user) && (
                <Link href="/admin" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-brand-50 sm:block">
                  Admin
                </Link>
              )}
              <NotificationBell />
              <ButtonLink href="/dashboard" variant="secondary" className="hidden sm:inline-flex">
                {user.name.split(" ")[0]}
              </ButtonLink>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-brand-50 sm:block">
                Sign in
              </Link>
              <ButtonLink href="/signup">Join free</ButtonLink>
            </>
          )}
          <MobileMenu links={[...links, ...(user ? [{ href: "/dashboard", label: "Dashboard" }] : [{ href: "/login", label: "Sign in" }])]} />
        </div>
      </div>
    </header>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1f8048" />
      <path d="M9 18.5c0-4.5 3.4-8.5 9.5-9.5-.6 6.7-4.1 10.5-8.2 10.6M9 18.5c1.8-2.3 4.3-4.1 7-5.2M9 18.5V23" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
