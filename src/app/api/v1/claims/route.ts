import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

/** Everything the user is involved in: as recipient and as donor. */
export const GET = api(async () => {
  const user = await requireUser();
  const include = { listing: { select: { id: true, title: true, unit: true, pickupEnd: true, mode: true, city: true } } };
  const [asRecipient, asDonor] = await Promise.all([
    db.claim.findMany({ where: { claimantId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include }),
    db.claim.findMany({ where: { listing: { ownerId: user.id } }, orderBy: { createdAt: "desc" }, take: 50, include }),
  ]);
  const strip = <T extends { pickupCode: string }>(c: T) => ({ ...c, pickupCode: undefined });
  return { asRecipient: asRecipient.map(strip), asDonor: asDonor.map(strip) };
});
