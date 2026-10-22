import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { signedFileUrl } from "@/lib/storage";

export const GET = api(async () => {
  await requireStaff();
  const orgs = await db.organization.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: { documents: { where: { status: "PENDING" } }, members: { select: { name: true, email: true } } },
  });
  return {
    organizations: await Promise.all(
      orgs.map(async (o) => ({ ...o, documents: await Promise.all(o.documents.map(async (d) => ({ ...d, url: await signedFileUrl(d.fileKey) }))) })),
    ),
  };
});
