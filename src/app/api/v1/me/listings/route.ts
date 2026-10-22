import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export const GET = api(async () => {
  const user = await requireUser();
  const listings = await db.listing.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { claims: true } } },
  });
  return { listings };
});
