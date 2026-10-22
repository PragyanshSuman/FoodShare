import type { FoodCategory, ListingMode, StorageType } from "@prisma/client";
import { PLATFORM } from "../config";

export type ListingTiming = {
  mode: ListingMode;
  category: FoodCategory;
  storage: StorageType;
  preparedAt?: Date | null;
  expiresAt: Date;
  pickupStart: Date;
  pickupEnd: Date;
  priceCents: number;
  originalPriceCents?: number | null;
  safetyAck: boolean;
  requiresApproval: boolean;
};

const HOUR = 3_600_000;

/**
 * Food-safety and consistency rules shared by the API, recurring schedules and
 * the seed script. Returns every violation so the form can show them at once.
 */
export function listingViolations(l: ListingTiming, now = new Date()): string[] {
  const errors: string[] = [];
  const isCooked = l.category === "PREPARED_MEAL" || l.storage === "HOT";

  if (l.pickupEnd <= l.pickupStart) errors.push("Pickup window must end after it starts");
  if (l.pickupEnd <= now) errors.push("Pickup window must end in the future");
  if (l.pickupEnd > l.expiresAt) errors.push("Pickup must end before the food's safe-until time");
  if (l.expiresAt <= now) errors.push("Safe-until time must be in the future");
  if (l.pickupStart.getTime() - now.getTime() > 14 * 24 * HOUR) errors.push("Pickup cannot start more than 14 days ahead");

  if (isCooked) {
    if (!l.preparedAt) errors.push("Cooked food needs a preparation time");
    if (!l.safetyAck) errors.push("Confirm the food-safety checklist for cooked food");
  }
  if (l.preparedAt) {
    if (l.preparedAt > now) errors.push("Preparation time cannot be in the future");
    const shelfHours = (l.expiresAt.getTime() - l.preparedAt.getTime()) / HOUR;
    if (l.storage === "HOT" && shelfHours > PLATFORM.maxHoursHotFood)
      errors.push(`Hot-held food must be consumed within ${PLATFORM.maxHoursHotFood}h of preparation`);
    else if (l.category === "PREPARED_MEAL" && l.storage === "CHILLED" && shelfHours > PLATFORM.maxHoursChilledPrepared)
      errors.push(`Chilled prepared meals must be consumed within ${PLATFORM.maxHoursChilledPrepared}h`);
    else if (l.category === "PREPARED_MEAL" && l.storage === "AMBIENT" && shelfHours > PLATFORM.maxHoursPreparedMeal)
      errors.push(`Prepared meals at room temperature must be consumed within ${PLATFORM.maxHoursPreparedMeal}h`);
  }

  if (l.mode === "DONATION" && l.priceCents !== 0) errors.push("Donations must be free");
  if (l.mode === "SALE") {
    if (l.priceCents <= 0) errors.push("Set a price for surplus sales");
    if (!l.originalPriceCents || l.originalPriceCents <= l.priceCents)
      errors.push("Surplus sales must be discounted from the original price");
    else if (l.priceCents > l.originalPriceCents * 0.7)
      errors.push("Surplus sales must be at least 30% off the original price");
    if (l.requiresApproval) errors.push("Paid listings cannot require manual approval");
  }
  return errors;
}
