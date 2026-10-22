import { db } from "../db";
import { forbidden, notFound } from "../errors";
import type { CurrentUser } from "../auth/session";
import { nextRunAt } from "../domain/schedule";
import { listingSchema, type scheduleSchema } from "../validation";
import type { z } from "zod";
import { createListing, entitlementsFor } from "./listings";
import { notify } from "./notifications";

type ScheduleInput = z.infer<typeof scheduleSchema>;

/** Pro feature: e.g. a bakery auto-posts its end-of-day surplus every weekday at 20:00. */
export async function createSchedule(user: CurrentUser, input: ScheduleInput) {
  if (!entitlementsFor(user).recurringListings) throw forbidden("Recurring listings are a Pro feature");
  return db.recurringSchedule.create({
    data: {
      ownerId: user.id,
      organizationId: user.organization?.id ?? null,
      template: input.listing,
      daysOfWeek: input.daysOfWeek,
      publishAt: input.publishAt,
      pickupStartMin: input.pickupStartMin,
      pickupEndMin: input.pickupEndMin,
      expiresMin: input.expiresMin,
      tzOffsetMin: input.tzOffsetMin,
      nextRunAt: nextRunAt(input.daysOfWeek, input.publishAt, input.tzOffsetMin),
    },
  });
}

export async function setScheduleActive(user: CurrentUser, id: string, active: boolean) {
  const s = await db.recurringSchedule.findUnique({ where: { id } });
  if (!s || s.ownerId !== user.id) throw notFound("Schedule");
  return db.recurringSchedule.update({
    where: { id },
    data: { active, ...(active ? { nextRunAt: nextRunAt(s.daysOfWeek, s.publishAt, s.tzOffsetMin) } : {}) },
  });
}

export async function runDueSchedules(now = new Date()) {
  const due = await db.recurringSchedule.findMany({ where: { active: true, nextRunAt: { lte: now } }, take: 50 });
  let created = 0;
  for (const s of due) {
    // Advance first so a failure never causes a burst of duplicate listings.
    await db.recurringSchedule.update({ where: { id: s.id }, data: { lastRunAt: now, nextRunAt: nextRunAt(s.daysOfWeek, s.publishAt, s.tzOffsetMin, now) } });
    const owner = await db.user.findUnique({ where: { id: s.ownerId }, include: { organization: true } });
    if (!owner) continue;
    try {
      const at = (min: number) => new Date(now.getTime() + min * 60_000);
      const input = listingSchema.parse({
        ...(s.template as object),
        preparedAt: (s.template as { category?: string }).category === "PREPARED_MEAL" ? now : null,
        pickupStart: at(s.pickupStartMin),
        pickupEnd: at(s.pickupEndMin),
        expiresAt: at(s.expiresMin),
      });
      await createListing(owner, input, { scheduleId: s.id });
      created++;
    } catch (err) {
      await db.recurringSchedule.update({ where: { id: s.id }, data: { active: false } });
      await notify(owner.id, {
        type: "schedule.paused",
        title: "Recurring listing paused",
        body: `We couldn't publish your scheduled listing: ${(err as Error).message}. Fix it and re-enable the schedule.`,
        link: "/dashboard/listings",
        email: "now",
      });
    }
  }
  return created;
}
