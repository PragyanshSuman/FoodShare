import { z } from "zod";
import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { requireStaff } from "@/lib/auth/guards";
import { audit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";

const schema = z.object({
  action: z.enum(["suspend", "unsuspend", "make_moderator", "make_user", "reset_strikes"]),
  days: z.number().int().min(1).max(365).optional().default(14),
  reason: z.string().trim().max(300).optional(),
});

export const POST = api<{ id: string }>(async (req, { params }) => {
  const staff = await requireStaff();
  const id = (await params).id;
  const { action, days, reason } = await body(req, schema);
  if ((action === "make_moderator" || action === "make_user") && staff.role !== "ADMIN") throw forbidden("Only admins change roles");
  if (id === staff.id) throw forbidden("You can't moderate yourself");

  switch (action) {
    case "suspend":
      await db.user.update({ where: { id }, data: { status: "SUSPENDED", suspendedUntil: new Date(Date.now() + days * 86_400_000) } });
      await db.session.deleteMany({ where: { userId: id } });
      await notify(id, { type: "moderation", title: "Account suspended", body: reason ?? `Suspended for ${days} days.`, email: "now" });
      break;
    case "unsuspend":
      await db.user.update({ where: { id }, data: { status: "ACTIVE", suspendedUntil: null } });
      break;
    case "reset_strikes":
      await db.user.update({ where: { id }, data: { noShowStrikes: 0 } });
      break;
    case "make_moderator":
    case "make_user":
      await db.user.update({ where: { id }, data: { role: action === "make_moderator" ? "MODERATOR" : "USER" } });
      break;
  }
  await audit(staff.id, `user.${action}`, "User", id, { days, reason });
});
