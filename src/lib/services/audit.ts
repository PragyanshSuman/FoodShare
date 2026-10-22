import type { Prisma } from "@prisma/client";
import { db, type Tx } from "../db";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  meta?: Prisma.InputJsonValue,
  tx?: Tx,
) {
  await (tx ?? db).auditLog.create({ data: { actorId, action, entityType, entityId, meta } });
}
