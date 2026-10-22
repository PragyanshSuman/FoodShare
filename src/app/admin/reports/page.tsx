import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export default async function ReportsPage() {
  const reports = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: [{ reason: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: { reporter: { select: { name: true, email: true } } },
  });
  const link = (r: (typeof reports)[number]) =>
    r.targetType === "LISTING" ? `/listings/${r.targetId}` : r.targetType === "CLAIM" ? `/dashboard/claims/${r.targetId}` : `/admin/users?q=${r.targetId}`;
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Food-safety reports first. Three independent food-safety reports auto-pause a listing." />
      {reports.length === 0 && <Empty title="No open reports" />}
      {reports.map((r) => (
        <Card key={r.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.reason === "FOOD_SAFETY" ? "red" : "orange"}>{r.reason.replace("_", " ")}</Badge>
            <Link href={link(r)} className="text-sm font-medium text-brand-700">
              {r.targetType.toLowerCase()} {r.targetId.slice(-8)} →
            </Link>
            <span className="text-xs text-muted">
              by {r.reporter.name} · {formatDateTime(r.createdAt)}
            </span>
          </div>
          {r.details && <p className="text-sm">{r.details}</p>}
          <div className="flex flex-wrap gap-2">
            <ActionButton endpoint={`/api/v1/admin/reports/${r.id}`} body={{ action: "dismiss" }} prompt="Note (why dismissed):" promptField="note">
              Dismiss
            </ActionButton>
            <ActionButton endpoint={`/api/v1/admin/reports/${r.id}`} body={{ action: "warn_user" }} prompt="Warning message to the user:" promptField="note">
              Warn user
            </ActionButton>
            {r.targetType === "LISTING" && (
              <ActionButton endpoint={`/api/v1/admin/reports/${r.id}`} body={{ action: "remove_listing" }} prompt="Reason for removal:" promptField="note" variant="danger">
                Remove listing
              </ActionButton>
            )}
            <ActionButton endpoint={`/api/v1/admin/reports/${r.id}`} body={{ action: "suspend_user", suspendDays: 14 }} prompt="Reason for 14-day suspension:" promptField="note" variant="danger">
              Suspend 14d
            </ActionButton>
          </div>
        </Card>
      ))}
    </div>
  );
}
