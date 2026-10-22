/**
 * Demo data for local development: `npm run db:seed`.
 * Every account's password is "foodshare123". Intended for an empty database
 * (`npx prisma db push --force-reset && npm run db:seed` to start over).
 */
import { PrismaClient, type FoodCategory, type DietType, type StorageType, type ListingMode } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const CITY = { lat: 28.6315, lng: 77.2167, name: "New Delhi" };
const at = (min: number) => new Date(Date.now() + min * 60_000);

async function user(email: string, name: string, data: Record<string, unknown> = {}) {
  const passwordHash = await bcrypt.hash("foodshare123", 11);
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, emailVerifiedAt: new Date(), lat: CITY.lat, lng: CITY.lng, city: CITY.name, ...data },
  });
}

async function main() {
  const admin = await user("admin@foodshare.local", "Asha Admin", { role: "ADMIN" });

  const bistro = await db.organization.create({
    data: {
      name: "Green Bistro",
      kind: "BUSINESS",
      category: "restaurant",
      registrationNumber: "FSSAI-10019022000123",
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      plan: "PRO",
      planRenewsAt: at(30 * 24 * 60),
      phone: "+91 98100 11111",
      payoutDetails: "greenbistro@upi",
      locations: { create: { label: "Connaught Place kitchen", address: "Block E, Connaught Place, New Delhi", city: CITY.name, lat: 28.6328, lng: 77.2197, isDefault: true } },
    },
  });
  const bakery = await db.organization.create({
    data: { name: "Daily Crust Bakery", kind: "BUSINESS", category: "bakery", registrationNumber: "FSSAI-20719022000456", verificationStatus: "VERIFIED", verifiedAt: new Date() },
  });
  const shelter = await db.organization.create({
    data: { name: "Hope Night Shelter", kind: "NGO", category: "shelter", registrationNumber: "NGO-DL-2019-0042", taxExemptId: "80G/DEL/2020/112", verificationStatus: "VERIFIED", verifiedAt: new Date() },
  });

  const chef = await user("bistro@foodshare.local", "Ravi Mehra", { accountType: "BUSINESS", organizationId: bistro.id });
  const baker = await user("bakery@foodshare.local", "Sana Qureshi", { accountType: "BUSINESS", organizationId: bakery.id, lat: 28.6448, lng: 77.2167 });
  await user("shelter@foodshare.local", "Joseph Mathew", { accountType: "NGO", organizationId: shelter.id, lat: 28.6448, lng: 77.2085 });
  const neighbour = await user("priya@foodshare.local", "Priya Sharma", { lat: 28.6129, lng: 77.2295 });
  await user("vikram@foodshare.local", "Vikram Singh", { isVolunteer: true, lat: 28.628, lng: 77.22 });
  const sponsor = await user("csr@acme.local", "Acme CSR Team");

  type Seed = { owner: string; org?: string; mode?: ListingMode; title: string; category: FoodCategory; diet: DietType; storage: StorageType; qty: number; unit: string; kg: number; price?: number; original?: number; lat: number; lng: number; address: string; cooked?: boolean; allergens?: string[]; ngoMinutes?: number };
  const listings: Seed[] = [
    { owner: chef.id, org: bistro.id, title: "Paneer butter masala & jeera rice", category: "PREPARED_MEAL", diet: "VEGETARIAN", storage: "HOT", qty: 25, unit: "portions", kg: 0.45, lat: 28.6328, lng: 77.2197, address: "Block E, Connaught Place", cooked: true, allergens: ["dairy"], ngoMinutes: 30 },
    { owner: chef.id, org: bistro.id, mode: "SALE", title: "End-of-day thali boxes", category: "PREPARED_MEAL", diet: "VEGETARIAN", storage: "AMBIENT", qty: 8, unit: "boxes", kg: 0.6, price: 9_900, original: 29_900, lat: 28.6328, lng: 77.2197, address: "Block E, Connaught Place", cooked: true, allergens: ["dairy", "gluten"] },
    { owner: baker.id, org: bakery.id, title: "Sourdough & multigrain loaves", category: "BAKERY", diet: "VEGAN", storage: "AMBIENT", qty: 14, unit: "loaves", kg: 0.5, lat: 28.6448, lng: 77.2167, address: "Chandni Chowk Road", allergens: ["gluten"] },
    { owner: baker.id, org: bakery.id, mode: "SALE", title: "Surprise pastry bag", category: "BAKERY", diet: "EGGETARIAN", storage: "AMBIENT", qty: 6, unit: "boxes", kg: 0.8, price: 15_000, original: 45_000, lat: 28.6448, lng: 77.2167, address: "Chandni Chowk Road", allergens: ["gluten", "eggs", "dairy"] },
    { owner: neighbour.id, title: "Bananas and seasonal apples", category: "PRODUCE", diet: "VEGAN", storage: "AMBIENT", qty: 4, unit: "kg", kg: 1, lat: 28.6129, lng: 77.2295, address: "Pandara Road (exact address on confirmation)" },
  ];
  for (const l of listings) {
    await db.listing.create({
      data: {
        ownerId: l.owner,
        organizationId: l.org ?? null,
        mode: l.mode ?? "DONATION",
        title: l.title,
        description: "Seeded demo listing.",
        category: l.category,
        dietType: l.diet,
        allergens: l.allergens ?? [],
        quantityTotal: l.qty,
        quantityAvailable: l.qty,
        unit: l.unit,
        weightKgPerUnit: l.kg,
        priceCents: l.price ?? 0,
        originalPriceCents: l.original ?? null,
        currency: process.env.NEXT_PUBLIC_CURRENCY ?? "INR",
        storage: l.storage,
        preparedAt: l.cooked ? at(-20) : null,
        expiresAt: at(l.storage === "HOT" ? 200 : 10 * 60),
        pickupStart: at(0),
        pickupEnd: at(l.storage === "HOT" ? 180 : 5 * 60),
        address: l.address,
        city: CITY.name,
        lat: l.lat,
        lng: l.lng,
        safetyAck: Boolean(l.cooked),
        ngoPriorityUntil: l.ngoMinutes ? at(l.ngoMinutes) : null,
        publishedAt: new Date(),
      },
    });
  }

  // A paid sponsorship so the Rescue Fund can pay volunteer stipends out of the box.
  const sp = await db.sponsorship.create({ data: { sponsorId: sponsor.id, displayName: "Acme Foods", message: "Every meal counts.", amountCents: 600_000, currency: "INR", deliveriesFunded: 100, status: "ACTIVE" } });
  const order = await db.order.create({ data: { userId: sponsor.id, kind: "SPONSORSHIP", status: "PAID", provider: "seed", amountCents: 600_000, currency: "INR", platformFeeCents: 60_000, sponsorshipId: sp.id, paidAt: new Date() } });
  await db.ledgerEntry.createMany({
    data: [
      { account: "fund:rescue", amountCents: 540_000, currency: "INR", type: "SPONSOR_FUND", orderId: order.id },
      { account: "platform:revenue", amountCents: 60_000, currency: "INR", type: "PLATFORM_FEE", orderId: order.id },
    ],
  });

  console.log(`Seeded. Admin: ${admin.email} / foodshare123 (change it!). Also: bistro@, bakery@, shelter@, priya@, vikram@foodshare.local`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
