import { db } from "@/lib/db";
import { signedFileUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export default async function VerificationsPage() {
  const orgs = await db.organization.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: { documents: { where: { status: "PENDING" } }, members: { select: { name: true, email: true } } },
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Verification queue" subtitle="Check the registration number against the issuing registry (e.g. FSSAI FoSCoS, NGO Darpan) before approving." />
      {orgs.length === 0 && <Empty title="Queue is empty" />}
      {await Promise.all(
        orgs.map(async (o) => (
          <Card key={o.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  {o.name} <Badge tone="blue">{o.kind}</Badge> <Badge>{o.category}</Badge>
                </div>
                <div className="text-sm text-muted">
                  Reg. no: <span className="font-mono">{o.registrationNumber ?? "—"}</span> · Tax: {o.taxExemptId ?? "—"} · Submitted {formatDateTime(o.updatedAt)}
                </div>
                <div className="text-sm text-muted">{o.members.map((m) => `${m.name} <${m.email}>`).join(", ")}</div>
              </div>
              <div className="flex gap-2">
                <ActionButton endpoint={`/api/v1/admin/verifications/${o.id}`} body={{ approve: true }} variant="primary">
                  Approve
                </ActionButton>
                <ActionButton endpoint={`/api/v1/admin/verifications/${o.id}`} body={{ approve: false }} prompt="What needs fixing? (sent to the organisation)" promptField="note" variant="danger">
                  Reject
                </ActionButton>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2 text-sm">
              {await Promise.all(
                o.documents.map(async (d) => (
                  <li key={d.id}>
                    <a href={await signedFileUrl(d.fileKey)} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 hover:bg-brand-50">
                      📄 {d.docType.replace(/_/g, " ")}
                    </a>
                  </li>
                )),
              )}
            </ul>
          </Card>
        )),
      )}
    </div>
  );
}
