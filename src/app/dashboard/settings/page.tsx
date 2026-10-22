import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CATEGORY_LABEL } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { ProfileForm, PushToggle } from "./forms";

export default async function SettingsPage() {
  const user = await pageUser("/dashboard/settings");
  const alerts = await db.alertPreference.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <ProfileForm
        user={{
          name: user.name,
          phone: user.phone,
          city: user.city,
          lat: user.lat ?? env.defaultLat,
          lng: user.lng ?? env.defaultLng,
          isVolunteer: user.isVolunteer,
          notifyEmail: user.notifyEmail,
          notifyPush: user.notifyPush,
          emailDigest: user.emailDigest,
        }}
      />

      <Card className="space-y-3">
        <h2 className="font-semibold">Browser notifications</h2>
        <p className="text-sm text-muted">Instant alerts on this device for new food nearby, pickups and messages. Free — no SMS.</p>
        <PushToggle vapidKey={env.vapidPublicKey} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Food alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">
            No alerts yet. Set filters on the <a href="/browse" className="font-medium text-brand-700">Find food</a> page and tap &ldquo;Alert me&rdquo;.
          </p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium">{a.label}</span>
                  <span className="block text-muted">
                    within {a.radiusKm} km · {a.categories.length ? a.categories.map((c) => CATEGORY_LABEL[c]).join(", ") : "all food"}
                    {a.dietTypes.length ? ` · ${a.dietTypes.join(", ").toLowerCase()}` : ""}
                  </span>
                </span>
                <ActionButton endpoint={`/api/v1/me/alerts/${a.id}`} method="DELETE" variant="ghost">
                  Remove
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Your data</h2>
        <p className="text-sm text-muted">Download everything we hold about you, or close your account. Closing anonymises your profile; donation records stay for other users&apos; history.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/v1/me/export" variant="secondary">
            Download my data
          </ButtonLink>
          <ActionButton endpoint="/api/v1/me" method="DELETE" confirm="Close your account permanently? Active listings and reservations will be cancelled." variant="danger" redirectTo="/">
            Close account
          </ActionButton>
        </div>
      </Card>
    </div>
  );
}
