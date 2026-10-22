import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";

export const GET = api(async (req) => {
  await requireStaff();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, name: true, email: true, accountType: true, role: true, status: true, suspendedUntil: true,
      noShowStrikes: true, completedCount: true, ratingAvg: true, ratingCount: true, createdAt: true,
      organization: { select: { name: true, verificationStatus: true, plan: true } },
    },
  });
  return { users };
});
