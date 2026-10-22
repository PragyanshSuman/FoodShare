import Link from "next/link";

export function SiteFooter() {
  const cols = [
    { title: "Platform", links: [["Find food", "/browse"], ["Share food", "/listings/new"], ["Volunteer", "/dashboard/deliveries"], ["Impact", "/impact"]] },
    { title: "Business", links: [["Pricing", "/pricing"], ["Sponsor rescues", "/sponsor"], ["CSR reports", "/pricing#pro"]] },
    { title: "Safety", links: [["Food safety guide", "/guides/food-safety"], ["Community guidelines", "/guides/community-guidelines"], ["How it works", "/guides/how-it-works"]] },
    { title: "Legal", links: [["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"]] },
  ];
  return (
    <footer className="no-print mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 text-sm md:grid-cols-4">
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 font-semibold">{c.title}</div>
            <ul className="space-y-2 text-muted">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-brand-700">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} FoodShare. Donations are always free. No ads, ever.
      </div>
    </footer>
  );
}
