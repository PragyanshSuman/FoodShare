import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

export const GET = api(async () => {
  await requireAdmin();
  const payouts = await db.payout.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, organization: { select: { name: true, payoutDetails: true } } } } },
  });
  return { payouts };
});
