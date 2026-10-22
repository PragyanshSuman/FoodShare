import webpush from "web-push";
import { db } from "./db";
import { env } from "./env";

let configured = false;

export const pushEnabled = () => Boolean(env.vapidPublicKey && env.vapidPrivateKey);

/** Web Push is free (browser vendors deliver it) — our replacement for paid SMS. */
export async function sendPush(userId: string, payload: { title: string; body: string; link?: string | null }) {
  if (!pushEnabled()) return;
  if (!configured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    configured = true;
  }
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 3600 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the browser unsubscribed — prune so we stop paying for the attempt.
        if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else throw err;
      }
    }),
  );
}
