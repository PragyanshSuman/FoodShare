import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";

export const GET = api(async (req) => {
  await requireStaff();
  const status = new URL(req.url).searchParams.get("status") === "closed" ? { not: "OPEN" as const } : ("OPEN" as const);
  const reports = await db.report.findMany({
    where: { status },
    // Food safety first, then oldest.
    orderBy: [{ reason: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: { reporter: { select: { name: true, email: true } } },
  });
  return { reports };
});
