import { db, type Tx } from "../db";
import { enqueue } from "../jobs/queue";

export type NotifyInput = {
  type: string;
  title: string;
  body: string;
  link?: string;
  /** now = transactional email; digest = batched into the daily email; never = in-app/push only */
  email?: "now" | "digest" | "never";
  push?: boolean;
};

/**
 * Single fan-out point: in-app row + (optional) web push + (optional) email.
 * Delivery runs through the job queue, so request latency never waits on SMTP.
 */
export async function notify(userId: string, n: NotifyInput, tx?: Tx) {
  const client = tx ?? db;
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { notifyEmail: true, notifyPush: true, emailDigest: true, status: true },
  });
  if (!user || user.status === "DELETED") return;

  const emailMode = n.email ?? "never";
  const notification = await client.notification.create({
    data: {
      userId,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link ?? null,
      // Rows that will never be emailed are marked so the digest skips them.
      emailedAt: emailMode === "never" || !user.notifyEmail || (emailMode === "digest" && !user.emailDigest) ? new Date() : null,
    },
  });

  if (n.push !== false && user.notifyPush) {
    await enqueue("push.send", { userId, title: n.title, body: n.body, link: n.link ?? null }, { tx });
  }
  if (emailMode === "now" && user.notifyEmail) {
    await enqueue("email.send", { notificationId: notification.id }, { tx });
  }
}

export async function notifyMany(userIds: string[], n: NotifyInput, tx?: Tx) {
  for (const id of new Set(userIds)) await notify(id, n, tx);
}

export async function notifyStaff(n: NotifyInput, tx?: Tx) {
  const staff = await (tx ?? db).user.findMany({ where: { role: { in: ["ADMIN", "MODERATOR"] } }, select: { id: true } });
  await notifyMany(
    staff.map((s) => s.id),
    n,
    tx,
  );
}
