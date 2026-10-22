import { z } from "zod";
import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { locationSchema } from "@/lib/validation";
import { entitlementsFor } from "@/lib/services/listings";

export const POST = api(async (req) => {
  const user = await requireUser();
  const org = user.organization;
  if (!org) throw badRequest("Create your organisation profile first");
  const input = await body(req, locationSchema);
  const count = await db.location.count({ where: { organizationId: org.id } });
  const max = entitlementsFor(user).maxLocations;
  if (count >= max) throw forbidden(`Your plan includes ${max} location${max > 1 ? "s" : ""}. Upgrade to Pro for multi-location.`);
  const location = await db.$transaction(async (tx) => {
    const isDefault = input.isDefault || count === 0;
    if (isDefault) await tx.location.updateMany({ where: { organizationId: org.id }, data: { isDefault: false } });
    return tx.location.create({ data: { ...input, isDefault, organizationId: org.id } });
  });
  return { location };
});

export const DELETE = api(async (req) => {
  const user = await requireUser();
  const { id } = await body(req, z.object({ id: z.string() }));
  await db.location.deleteMany({ where: { id, organizationId: user.organizationId ?? "-", listings: { none: { status: { in: ["ACTIVE", "RESERVED"] } } } } });
});
