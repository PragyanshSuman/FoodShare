import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { organizationSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";

export const GET = api(async () => {
  const user = await requireUser();
  if (!user.organizationId) return { organization: null };
  const organization = await db.organization.findUnique({
    where: { id: user.organizationId },
    include: { locations: true, documents: { select: { id: true, docType: true, status: true, reviewNote: true, createdAt: true } } },
  });
  return { organization };
});

/** Create (for individuals upgrading) or update the caller's organisation. */
export const PATCH = api(async (req) => {
  const user = await requireUser();
  const input = await body(req, organizationSchema);
  if (!user.organization) {
    if (user.accountType === "INDIVIDUAL") throw badRequest("Switch to a business or NGO account first");
    const org = await db.organization.create({ data: { ...input, kind: user.accountType === "NGO" ? "NGO" : "BUSINESS" } });
    await db.user.update({ where: { id: user.id }, data: { organizationId: org.id } });
    return { organization: org };
  }
  // Changing legal identifiers after verification sends the org back for review.
  const identityChanged =
    user.organization.verificationStatus === "VERIFIED" &&
    (input.registrationNumber !== user.organization.registrationNumber || input.name !== user.organization.name);
  const organization = await db.organization.update({
    where: { id: user.organization.id },
    data: { ...input, ...(identityChanged ? { verificationStatus: "UNVERIFIED", verifiedAt: null } : {}) },
  });
  await audit(user.id, "org.updated", "Organization", organization.id, { identityChanged });
  return { organization, reverification: identityChanged };
});
