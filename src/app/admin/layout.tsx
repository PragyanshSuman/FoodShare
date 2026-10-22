import Link from "next/link";
import { pageStaff } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await pageStaff();
  const items = [
    ["/admin", "Overview"],
    ["/admin/verifications", "Verifications"],
    ["/admin/reports", "Reports"],
    ["/admin/payouts", "Payouts"],
    ["/admin/users", "Users"],
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line pb-3">
        {items.map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-white hover:text-ink">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
