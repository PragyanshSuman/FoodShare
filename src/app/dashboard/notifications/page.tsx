import Link from "next/link";
import { pageUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/actions";
import { Card, Empty, PageHeader } from "@/components/ui";

export default async function NotificationsPage() {
  const user = await pageUser("/dashboard/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread`}
        action={
          unread > 0 && (
            <ActionButton endpoint="/api/v1/me/notifications/read" body={{}}>
              Mark all read
            </ActionButton>
          )
        }
      />
      {items.length === 0 ? (
        <Empty title="You're all caught up" />
      ) : (
        <Card className="divide-y divide-line p-0">
          {items.map((n) => {
            const inner = (
              <div className={`flex gap-3 px-4 py-3 ${n.readAt ? "" : "bg-brand-50/60"}`}>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-500" />}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-sm text-muted">{n.body}</div>
                  <div className="mt-0.5 text-xs text-muted">{formatDateTime(n.createdAt)}</div>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-canvas">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
