import { pageUser } from "@/lib/auth/guards";
import { DashboardNav } from "./nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  const items = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/listings", label: "My listings" },
    { href: "/dashboard/claims", label: "Reservations" },
    ...(user.isVolunteer ? [{ href: "/dashboard/deliveries", label: "Deliveries" }] : []),
    { href: "/dashboard/impact", label: "Impact" },
    { href: "/dashboard/billing", label: "Billing & payouts" },
    ...(user.accountType !== "INDIVIDUAL" ? [{ href: "/dashboard/organization", label: "Organisation" }] : []),
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/settings", label: "Settings" },
  ];
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[200px_1fr]">
      <DashboardNav items={items} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
