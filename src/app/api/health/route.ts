import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Uptime probe (free monitors: UptimeRobot, Better Stack). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const backlog = await db.job.count({ where: { status: "PENDING", runAt: { lt: new Date(Date.now() - 15 * 60_000) } } });
    return Response.json({ ok: true, db: "up", jobBacklog: backlog });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
