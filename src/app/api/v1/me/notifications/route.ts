import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export const GET = api(async (req) => {
  const user = await requireUser();
  const before = new URL(req.url).searchParams.get("before");
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, unread };
});
