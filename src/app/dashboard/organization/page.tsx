import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { entitlementsFor } from "@/lib/services/listings";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { OrgForm, LocationForm, VerificationForm } from "./forms";
import { ActionButton } from "@/components/actions";

const STATUS = {
  UNVERIFIED: { tone: "gray", label: "Not verified" },
  PENDING: { tone: "orange", label: "Under review" },
  VERIFIED: { tone: "green", label: "Verified" },
  REJECTED: { tone: "red", label: "Needs changes" },
} as const;

export default async function OrganizationPage() {
  const user = await pageUser("/dashboard/organization");
  const org = user.organizationId
    ? await db.organization.findUnique({ where: { id: user.organizationId }, include: { locations: true, documents: { orderBy: { createdAt: "desc" } } } })
    : null;
  const ent = entitlementsFor(user);
  const isNgo = user.accountType === "NGO";

  return (
    <div className="space-y-6">
      <PageHeader title="Organisation" subtitle={org ? <Badge tone={STATUS[org.verificationStatus].tone}>{STATUS[org.verificationStatus].label}</Badge> : "Set up your organisation profile"} />
      {org?.verificationStatus === "REJECTED" && org.rejectionReason && <Notice tone="error">Reviewer note: {org.rejectionReason}</Notice>}

      <OrgForm
        org={org ? { name: org.name, category: org.category, description: org.description, website: org.website, phone: org.phone, registrationNumber: org.registrationNumber, taxExemptId: org.taxExemptId, payoutDetails: org.payoutDetails } : null}
        isNgo={isNgo}
      />

      {org && (
        <>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pickup locations</h2>
              <span className="text-xs text-muted">
                {org.locations.length}/{ent.maxLocations} on your plan
              </span>
            </div>
            {org.locations.length > 0 && (
              <ul className="divide-y divide-line text-sm">
                {org.locations.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{l.label}</span> {l.isDefault && <Badge tone="green">Default</Badge>}
                      <span className="block text-muted">{l.address}</span>
                    </span>
                    <ActionButton endpoint="/api/v1/organization/locations" method="DELETE" body={{ id: l.id }} confirm="Remove this location?" variant="ghost">
                      Remove
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            {org.locations.length < ent.maxLocations && <LocationForm defaultLat={env.defaultLat} defaultLng={env.defaultLng} />}
          </Card>

          {org.verificationStatus !== "VERIFIED" && org.verificationStatus !== "PENDING" && (
            <VerificationForm isNgo={isNgo} hasRegistration={Boolean(org.registrationNumber)} />
          )}
          {org.documents.length > 0 && (
            <Card>
              <h2 className="mb-2 font-semibold">Submitted documents</h2>
              <ul className="text-sm">
                {org.documents.map((d) => (
                  <li key={d.id} className="flex justify-between py-1">
                    <span>{d.docType.replace(/_/g, " ")}</span>
                    <span className="text-muted">{d.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
