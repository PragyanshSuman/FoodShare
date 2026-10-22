import { z } from "zod";

const coerceDate = z.coerce.date();
const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const FOOD_CATEGORIES = ["PREPARED_MEAL", "BAKERY", "PRODUCE", "DAIRY", "PACKAGED", "BEVERAGES", "GROCERY", "MIXED"] as const;
export const DIET_TYPES = ["VEGETARIAN", "VEGAN", "EGGETARIAN", "NON_VEGETARIAN"] as const;
export const STORAGE_TYPES = ["HOT", "AMBIENT", "CHILLED", "FROZEN"] as const;
export const ALLERGENS = ["gluten", "dairy", "eggs", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame", "mustard"] as const;

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  accountType: z.enum(["INDIVIDUAL", "BUSINESS", "NGO"]),
  isVolunteer: z.boolean().optional().default(false),
  organizationName: z.string().trim().min(2).max(120).optional(),
  organizationCategory: z.string().trim().max(60).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const listingSchema = z.object({
  mode: z.enum(["DONATION", "SALE"]).default("DONATION"),
  title: z.string().trim().min(3).max(100),
  description: optionalText(2000),
  category: z.enum(FOOD_CATEGORIES),
  dietType: z.enum(DIET_TYPES),
  allergens: z.array(z.enum(ALLERGENS)).max(10).default([]),
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(10).default([]),
  quantityTotal: z.coerce.number().int().min(1).max(10_000),
  unit: z.string().trim().min(1).max(20).default("portions"),
  weightKgPerUnit: z.coerce.number().min(0.01).max(1000).default(0.4),
  priceCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  originalPriceCents: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  storage: z.enum(STORAGE_TYPES),
  preparedAt: coerceDate.optional().nullable(),
  expiresAt: coerceDate,
  pickupStart: coerceDate,
  pickupEnd: coerceDate,
  locationId: z.string().optional().nullable(),
  address: z.string().trim().min(5).max(250),
  city: optionalText(80),
  lat,
  lng,
  pickupInstructions: optionalText(500),
  photoKeys: z.array(z.string().max(200)).max(5).default([]),
  audience: z.enum(["EVERYONE", "VERIFIED_NGO_ONLY"]).default("EVERYONE"),
  ngoPriorityMinutes: z.coerce.number().int().min(0).max(240).default(0),
  requiresApproval: z.boolean().default(false),
  allowsDelivery: z.boolean().default(true),
  maxPerClaim: z.coerce.number().int().min(1).optional().nullable(),
  safetyAck: z.boolean().default(false),
});
export type ListingInput = z.infer<typeof listingSchema>;

// While claims are active, only non-breaking fields may change.
export const listingPatchSchema = listingSchema.partial().extend({
  description: optionalText(2000),
  pickupInstructions: optionalText(500),
});

export const searchSchema = z.object({
  lat: lat.optional(),
  lng: lng.optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).optional(),
  q: z.string().trim().max(80).optional(),
  category: z.enum(FOOD_CATEGORIES).optional(),
  diet: z.enum(DIET_TYPES).optional(),
  mode: z.enum(["DONATION", "SALE"]).optional(),
  excludeAllergens: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : [])),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export const claimSchema = z.object({
  quantity: z.coerce.number().int().min(1),
  fulfilment: z.enum(["SELF_PICKUP", "VOLUNTEER_DELIVERY"]).default("SELF_PICKUP"),
  note: optionalText(300),
  dropAddress: optionalText(250),
  dropLat: lat.optional().nullable(),
  dropLng: lng.optional().nullable(),
  tipCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  tags: z.array(z.string().max(30)).max(6).default([]),
  comment: optionalText(500),
});

export const reportSchema = z.object({
  targetType: z.enum(["LISTING", "USER", "CLAIM"]),
  targetId: z.string().min(1),
  reason: z.enum(["FOOD_SAFETY", "NO_SHOW", "MISREPRESENTED", "HARASSMENT", "FRAUD", "OTHER"]),
  details: optionalText(1000),
});

export const alertSchema = z.object({
  label: z.string().trim().min(1).max(60).default("Near me"),
  lat,
  lng,
  radiusKm: z.coerce.number().min(0.5).max(50),
  categories: z.array(z.enum(FOOD_CATEGORIES)).default([]),
  dietTypes: z.array(z.enum(DIET_TYPES)).default([]),
  modes: z.array(z.enum(["DONATION", "SALE"])).default([]),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: optionalText(20),
  city: optionalText(80),
  lat: lat.optional().nullable(),
  lng: lng.optional().nullable(),
  isVolunteer: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  description: optionalText(1000),
  website: optionalText(200),
  phone: optionalText(20),
  registrationNumber: optionalText(60),
  taxExemptId: optionalText(60),
  payoutDetails: optionalText(200),
});

export const locationSchema = z.object({
  label: z.string().trim().min(1).max(60),
  address: z.string().trim().min(5).max(250),
  city: optionalText(80),
  lat,
  lng,
  isDefault: z.boolean().default(false),
});

export const scheduleSchema = z.object({
  listing: listingSchema.omit({ preparedAt: true, expiresAt: true, pickupStart: true, pickupEnd: true }),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  publishAt: z.string().regex(/^\d{2}:\d{2}$/),
  pickupStartMin: z.number().int().min(0).max(24 * 60),
  pickupEndMin: z.number().int().min(15).max(48 * 60),
  expiresMin: z.number().int().min(30).max(14 * 24 * 60),
  tzOffsetMin: z.number().int().min(-720).max(840).default(330),
});
