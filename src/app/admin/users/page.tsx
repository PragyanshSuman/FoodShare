import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Badge, Card, Input, PageHeader } from "@/components/ui";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim();
  const users = await db.user.findMany({
    where: q ? { OR: [{ id: q }, { email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { organization: { select: { name: true, verificationStatus: true, plan: true } } },
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Users" />
      <form>
        <Input name="q" defaultValue={q} placeholder="Search by name, email or id" className="max-w-md" />
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Trust</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted">
                    {u.email} · joined {formatDateTime(u.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {u.accountType.toLowerCase()}
                  {u.organization && <div className="text-xs text-muted">{u.organization.name} · {u.organization.verificationStatus.toLowerCase()} · {u.organization.plan}</div>}
                  {u.role !== "USER" && <Badge tone="blue">{u.role}</Badge>}
                </td>
                <td className="px-4 py-2 text-xs">
                  {u.completedCount} rescues · {u.ratingCount ? `${u.ratingAvg}★` : "no rating"} · {u.noShowStrikes} strikes
                </td>
                <td className="px-4 py-2">
                  <Badge tone={u.status === "ACTIVE" ? "green" : u.status === "SUSPENDED" ? "red" : "gray"}>{u.status.toLowerCase()}</Badge>
                  {u.suspendedUntil && <div className="text-xs text-muted">until {formatDateTime(u.suspendedUntil)}</div>}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {u.status === "ACTIVE" ? (
                      <ActionButton endpoint={`/api/v1/admin/users/${u.id}`} body={{ action: "suspend", days: 14 }} prompt="Reason for suspension:" variant="ghost">
                        Suspend
                      </ActionButton>
                    ) : u.status === "SUSPENDED" ? (
                      <ActionButton endpoint={`/api/v1/admin/users/${u.id}`} body={{ action: "unsuspend" }} variant="ghost">
                        Unsuspend
                      </ActionButton>
                    ) : null}
                    {u.noShowStrikes > 0 && (
                      <ActionButton endpoint={`/api/v1/admin/users/${u.id}`} body={{ action: "reset_strikes" }} variant="ghost">
                        Reset strikes
                      </ActionButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
