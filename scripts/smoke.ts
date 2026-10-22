/**
 * End-to-end smoke test against a running server (npm run dev, PAYMENT_PROVIDER=mock).
 * Drives the real HTTP API as several users and checks every cross-feature flow:
 * donation → handover → reviews → impact; paid surplus → settlement → payout;
 * NGO priority; volunteer delivery funded by a sponsor; subscriptions; refunds;
 * moderation auto-pause; the time-based sweep (no-shows, expiry); privacy.
 *
 *   npm run smoke
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const CRON = process.env.CRON_SECRET ?? "change-me-cron";
const db = new PrismaClient();
const run = Date.now().toString(36);
let passed = 0;

let ipSeq = 0;

class Client {
  cookie = "";
  // Each simulated user gets its own IP so per-IP rate limits behave like production.
  ip = `10.${run.length}.${Math.floor(Math.random() * 250)}.${++ipSeq}`;
  constructor(public label: string) {}
  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "x-real-ip": this.ip,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set?.includes("fs_session=")) this.cookie = set.split(";")[0];
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json };
  }
  async ok(method: string, path: string, body?: unknown) {
    const r = await this.req(method, path, body);
    if (r.status >= 400) throw new Error(`[${this.label}] ${method} ${path} → ${r.status} ${JSON.stringify(r.json)}`);
    return r.json;
  }
  async fails(method: string, path: string, body: unknown, status: number, match?: RegExp) {
    const r = await this.req(method, path, body);
    if (r.status !== status) throw new Error(`[${this.label}] ${method} ${path} expected ${status}, got ${r.status} ${JSON.stringify(r.json)}`);
    if (match && !match.test(r.json?.error?.message ?? "")) throw new Error(`[${this.label}] message "${r.json?.error?.message}" !~ ${match}`);
    return r.json;
  }
}

function check(cond: unknown, what: string) {
  if (!cond) throw new Error(`✗ ${what}`);
  passed++;
  console.log(`  ✓ ${what}`);
}

const LAT = 28.6315;
const LNG = 77.2167;
const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

async function signup(label: string, accountType: "INDIVIDUAL" | "BUSINESS" | "NGO", extra: Record<string, unknown> = {}) {
  const c = new Client(label);
  await c.ok("POST", "/api/v1/auth/signup", {
    name: `${label} Tester`,
    email: `${label.toLowerCase()}-${run}@example.test`,
    password: "correct-horse-42",
    accountType,
    acceptTerms: true,
    ...(accountType !== "INDIVIDUAL" ? { organizationName: `${label} Org ${run}` } : {}),
    ...extra,
  });
  return c;
}

const verifyEmail = (label: string) =>
  db.user.update({ where: { email: `${label.toLowerCase()}-${run}@example.test` }, data: { emailVerifiedAt: new Date(), lat: LAT, lng: LNG } });

function donation(over: Record<string, unknown> = {}) {
  return {
    mode: "DONATION",
    title: `Veg biryani trays ${run}`,
    description: "Fresh from tonight's service, packed in sealed containers.",
    category: "PREPARED_MEAL",
    dietType: "VEGETARIAN",
    allergens: ["dairy"],
    quantityTotal: 10,
    unit: "portions",
    weightKgPerUnit: 0.4,
    storage: "AMBIENT",
    preparedAt: at(-30),
    expiresAt: at(8 * 60),
    pickupStart: at(0),
    pickupEnd: at(3 * 60),
    address: "Shop 12, Connaught Place, New Delhi",
    city: "New Delhi",
    lat: LAT,
    lng: LNG,
    pickupInstructions: "Ask for Ravi at the back door",
    safetyAck: true,
    ...over,
  };
}

async function main() {
  console.log(`Smoke test against ${BASE} (run ${run})\n`);
  const health = await new Client("probe").ok("GET", "/api/health");
  check(health.ok, "health endpoint reports DB up");

  // ── Accounts ──────────────────────────────────────────────────────────
  console.log("\nAccounts & auth");
  const donor = await signup("Donor", "BUSINESS");
  const ngo = await signup("Ngo", "NGO");
  const alice = await signup("Alice", "INDIVIDUAL");
  const bob = await signup("Bob", "INDIVIDUAL");
  const vol = await signup("Vol", "INDIVIDUAL", { isVolunteer: true });
  const sponsor = await signup("Sponsor", "INDIVIDUAL");
  const admin = await signup("Admin", "INDIVIDUAL");
  const carol = await signup("Carol", "INDIVIDUAL");

  await donor.fails("POST", "/api/v1/listings", donation(), 403, /Verify your email/);
  check(true, "unverified users cannot post");
  for (const l of ["Donor", "Ngo", "Alice", "Bob", "Vol", "Sponsor", "Admin", "Carol"]) await verifyEmail(l);
  await db.user.update({ where: { email: `admin-${run}@example.test` }, data: { role: "ADMIN" } });

  const anon = new Client("anon");
  await anon.fails("POST", "/api/v1/auth/login", { email: `alice-${run}@example.test`, password: "wrong-password" }, 401);
  await anon.ok("POST", "/api/v1/auth/login", { email: `alice-${run}@example.test`, password: "correct-horse-42" });
  check(anon.cookie.startsWith("fs_session="), "login issues a session cookie");
  const me = await alice.ok("GET", "/api/v1/me");
  check(me.user && !("passwordHash" in me.user), "/me never leaks the password hash");

  // ── Donation → handover → review → impact ────────────────────────────
  console.log("\nFree donation lifecycle");
  await donor.fails("POST", "/api/v1/listings", donation({ storage: "HOT", expiresAt: at(6 * 60) }), 400, /within 4h/);
  check(true, "food-safety rule: hot food over 4h is rejected");
  const { listing: l1 } = await donor.ok("POST", "/api/v1/listings", donation());
  const search = await alice.ok("GET", `/api/v1/listings?lat=${LAT}&lng=${LNG}&radiusKm=3&diet=VEGETARIAN`);
  check(search.items.some((i: any) => i.id === l1.id), "listing appears in geo + diet search");
  await alice.fails("POST", `/api/v1/listings/${l1.id}/claims`, { quantity: 11 }, 409, /Only 10 left/);
  const veganSearch = await alice.ok("GET", `/api/v1/listings?lat=${LAT}&lng=${LNG}&diet=VEGAN`);
  check(!veganSearch.items.some((i: any) => i.id === l1.id), "vegetarian food is hidden from vegan searches");
  const dairyFree = await alice.ok("GET", `/api/v1/listings?lat=${LAT}&lng=${LNG}&excludeAllergens=dairy`);
  check(!dairyFree.items.some((i: any) => i.id === l1.id), "allergen exclusion filter works");

  const c1 = await alice.ok("POST", `/api/v1/listings/${l1.id}/claims`, { quantity: 2 });
  check(c1.claim.status === "CONFIRMED", "free claim is confirmed instantly");
  const aliceView = await alice.ok("GET", `/api/v1/claims/${c1.claim.id}`);
  const donorView = await donor.ok("GET", `/api/v1/claims/${c1.claim.id}`);
  check(/^\d{6}$/.test(aliceView.claim.pickupCode) && donorView.claim.pickupCode === null, "handover code visible only to the collector");
  await bob.fails("GET", `/api/v1/claims/${c1.claim.id}`, undefined, 404);
  check(true, "outsiders cannot read someone else's claim");
  await alice.ok("POST", `/api/v1/claims/${c1.claim.id}/messages`, { body: "On my way, 10 minutes!" });
  const msgs = await donor.ok("GET", `/api/v1/claims/${c1.claim.id}/messages`);
  check(msgs.messages.length === 1, "claim chat delivers messages");
  await donor.fails("POST", `/api/v1/claims/${c1.claim.id}/handover`, { code: "000000" === aliceView.claim.pickupCode ? "111111" : "000000" }, 400, /Incorrect code/);
  await donor.ok("POST", `/api/v1/claims/${c1.claim.id}/handover`, { code: aliceView.claim.pickupCode });
  const done = await db.claim.findUniqueOrThrow({ where: { id: c1.claim.id } });
  check(done.status === "COMPLETED" && done.kgSaved === 0.8 && done.meals === 1.6, "handover completes claim and records impact");
  await alice.ok("POST", `/api/v1/claims/${c1.claim.id}/review`, { rating: 5, tags: ["fresh"] });
  await donor.ok("POST", `/api/v1/claims/${c1.claim.id}/review`, { rating: 4 });
  await alice.fails("POST", `/api/v1/claims/${c1.claim.id}/review`, { rating: 1 }, 409);
  const donorUser = await db.user.findUniqueOrThrow({ where: { email: `donor-${run}@example.test` } });
  check(donorUser.ratingAvg === 5 && donorUser.ratingCount === 1, "reviews update ratings once per party");
  const notifs = await donor.ok("GET", "/api/v1/me/notifications");
  check(notifs.items.some((n: any) => n.type === "claim.confirmed"), "donor was notified of the claim");

  // ── Concurrency: last portion ─────────────────────────────────────────
  console.log("\nRace for the last portion");
  const { listing: l2 } = await donor.ok("POST", "/api/v1/listings", donation({ title: `Last loaf ${run}`, category: "BAKERY", storage: "AMBIENT", preparedAt: null, quantityTotal: 1, unit: "loaves" }));
  const race = await Promise.all([bob.req("POST", `/api/v1/listings/${l2.id}/claims`, { quantity: 1 }), carol.req("POST", `/api/v1/listings/${l2.id}/claims`, { quantity: 1 })]);
  check(race.filter((r) => r.status === 200).length === 1 && race.filter((r) => r.status === 409).length === 1, "exactly one of two simultaneous claims wins");
  const l2db = await db.listing.findUniqueOrThrow({ where: { id: l2.id } });
  check(l2db.status === "RESERVED" && l2db.quantityAvailable === 0, "listing becomes RESERVED with zero stock");
  const winner = race.find((r) => r.status === 200)!;
  const winnerClient = race[0].status === 200 ? bob : carol;
  await winnerClient.ok("POST", `/api/v1/claims/${winner.json.claim.id}/cancel`, { reason: "Plans changed" });
  const l2after = await db.listing.findUniqueOrThrow({ where: { id: l2.id } });
  check(l2after.status === "ACTIVE" && l2after.quantityAvailable === 1, "cancellation returns stock and reopens listing");

  // ── Verification & paid surplus ───────────────────────────────────────
  console.log("\nVerification → paid surplus → settlement");
  const sale = { ...donation({ title: `Surplus cake box ${run}`, category: "BAKERY", preparedAt: null }), mode: "SALE", priceCents: 60_000, originalPriceCents: 150_000, quantityTotal: 3, unit: "boxes", weightKgPerUnit: 1.2 };
  await donor.fails("POST", "/api/v1/listings", sale, 403, /Verify your business/);
  check(true, "unverified businesses cannot sell");
  const up = await donor.ok("POST", "/api/v1/uploads", { purpose: "verification", contentType: "application/pdf", size: 12 });
  const put = await fetch(BASE + up.uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: "%PDF-1.4 x" });
  check(put.ok, "signed upload accepted");
  await donor.ok("PATCH", "/api/v1/organization", { name: `Donor Org ${run}`, category: "restaurant", registrationNumber: "FSSAI-10019022000123", phone: "+91 98100 00000" });
  await donor.ok("POST", "/api/v1/organization/verification", { documents: [{ docType: "fssai_licence", fileKey: up.key }] });
  const queue = await admin.ok("GET", "/api/v1/admin/verifications");
  const donorOrg = queue.organizations.find((o: any) => o.name === `Donor Org ${run}`);
  check(donorOrg && donorOrg.documents[0].url.includes("sig="), "admin sees the document via a signed private URL");
  await alice.fails("GET", "/api/v1/admin/verifications", undefined, 403);
  await admin.ok("POST", `/api/v1/admin/verifications/${donorOrg.id}`, { approve: true });

  await donor.fails("POST", "/api/v1/listings", { ...sale, priceCents: 140_000 }, 400, /30% off/);
  const { listing: l3 } = await donor.ok("POST", "/api/v1/listings", sale);
  const buy = await bob.ok("POST", `/api/v1/listings/${l3.id}/claims`, { quantity: 1, tipCents: 2_000 });
  check(buy.claim.status === "PENDING_PAYMENT" && buy.checkout.redirectUrl.startsWith("/checkout/mock"), "sale claim holds stock pending payment");
  await bob.ok("POST", "/api/v1/payments/mock", { orderId: buy.checkout.orderId, outcome: "success" });
  await bob.ok("POST", "/api/v1/payments/mock", { orderId: buy.checkout.orderId, outcome: "success" }); // duplicate webhook
  const paid = await db.order.findUniqueOrThrow({ where: { id: buy.checkout.orderId } });
  check(paid.status === "PAID" && paid.amountCents === 62_000 && paid.platformFeeCents === 9_000, "payment is idempotent; 15% commission + tip recorded");
  const bobClaim = await bob.ok("GET", `/api/v1/claims/${buy.claim.id}`);
  check(bobClaim.claim.status === "CONFIRMED", "paid claim confirmed");
  let summary = await donor.ok("GET", "/api/v1/billing/summary");
  check(summary.balance === 0, "seller is not credited before handover");
  await donor.ok("POST", `/api/v1/claims/${buy.claim.id}/handover`, { code: bobClaim.claim.pickupCode });
  summary = await donor.ok("GET", "/api/v1/billing/summary");
  check(summary.balance === 51_000, "seller credited price minus commission on handover");
  await donor.ok("POST", "/api/v1/billing/payouts", { amountCents: 51_000, destination: "donor@upi" });
  await donor.fails("POST", "/api/v1/billing/payouts", { amountCents: 51_000, destination: "donor@upi" }, 409);
  check(true, "cannot double-request the same balance");
  const payouts = await admin.ok("GET", "/api/v1/admin/payouts");
  const pay = payouts.payouts.find((p: any) => p.user.email === `donor-${run}@example.test`);
  await admin.ok("POST", `/api/v1/admin/payouts/${pay.id}`, { approve: true, reference: "UTR123456789" });
  summary = await donor.ok("GET", "/api/v1/billing/summary");
  check(summary.balance === 0, "paid payout debits the ledger");

  // Buyer cancels a paid order well before the deadline → refund.
  const buy2 = await carol.ok("POST", `/api/v1/listings/${l3.id}/claims`, { quantity: 1 });
  await carol.ok("POST", "/api/v1/payments/mock", { orderId: buy2.checkout.orderId, outcome: "success" });
  await carol.ok("POST", `/api/v1/claims/${buy2.claim.id}/cancel`, { reason: "Can't make it" });
  const refunded = await db.order.findUniqueOrThrow({ where: { id: buy2.checkout.orderId } });
  check(refunded.status === "REFUNDED", "early buyer cancellation is refunded");

  // ── Pro subscription ──────────────────────────────────────────────────
  console.log("\nPro subscription");
  await donor.fails("GET", "/api/v1/impact/report", undefined, 403, /Pro feature/);
  const sub = await donor.ok("POST", "/api/v1/billing/subscribe", { period: "monthly" });
  await donor.ok("POST", "/api/v1/payments/mock", { orderId: sub.checkout.orderId, outcome: "success" });
  summary = await donor.ok("GET", "/api/v1/billing/summary");
  check(summary.plan === "PRO" && summary.entitlements.saleCommissionBps === 1000, "Pro activates with lower commission");
  const csv = await donor.req("GET", "/api/v1/impact/report");
  check(csv.status === 200 && String(csv.json).startsWith("date,item"), "CSR CSV export available on Pro");
  const sched = await donor.ok("POST", "/api/v1/schedules", {
    listing: { ...donation(), preparedAt: undefined, expiresAt: undefined, pickupStart: undefined, pickupEnd: undefined, category: "BAKERY", title: `Daily bread ${run}` },
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    publishAt: "20:00",
    pickupStartMin: 0,
    pickupEndMin: 120,
    expiresMin: 600,
  });
  check(new Date(sched.schedule.nextRunAt) > new Date(), "recurring schedule computes its next run");

  // ── NGO priority + sponsored volunteer delivery ──────────────────────
  console.log("\nNGO priority & volunteer delivery");
  const ngoUser = await db.user.findUniqueOrThrow({ where: { email: `ngo-${run}@example.test` } });
  await db.organization.update({ where: { id: ngoUser.organizationId! }, data: { verificationStatus: "VERIFIED", registrationNumber: "NGO-DL-2021-0042" } });

  const sp = await sponsor.ok("POST", "/api/v1/billing/sponsor", { amountCents: 600_000, displayName: `Acme Foods ${run}`, message: "Proud to fuel rescues" });
  await sponsor.ok("POST", "/api/v1/payments/mock", { orderId: sp.checkout.orderId, outcome: "success" });
  const fundBefore = (await db.ledgerEntry.aggregate({ where: { account: "fund:rescue" }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
  check(fundBefore >= 540_000, "sponsorship funds the Rescue Fund (minus 10% fee)");

  const { listing: l4 } = await donor.ok("POST", "/api/v1/listings", donation({ title: `Dal & rice ${run}`, ngoPriorityMinutes: 30, quantityTotal: 40 }));
  await alice.fails("POST", `/api/v1/listings/${l4.id}/claims`, { quantity: 1 }, 409, /NGOs get first access/);
  check(true, "individuals wait during the NGO priority window");
  const dropLat = LAT + 0.02;
  const nc = await ngo.ok("POST", `/api/v1/listings/${l4.id}/claims`, { quantity: 30, fulfilment: "VOLUNTEER_DELIVERY", dropAddress: "Shelter, Paharganj", dropLat, dropLng: LNG });
  check(nc.claim.status === "CONFIRMED", "verified NGO claims during priority, with delivery");
  const open = await vol.ok("GET", `/api/v1/deliveries?lat=${LAT}&lng=${LNG}`);
  const task = open.open.find((t: any) => t.title === `Dal & rice ${run}`);
  check(task && task.estStipendCents > 0, "volunteer sees the open delivery with an estimated stipend");
  await bob.fails("POST", `/api/v1/deliveries/${task.id}/accept`, undefined, 403, /volunteering/);
  await vol.ok("POST", `/api/v1/deliveries/${task.id}/accept`);
  await carol.fails("POST", `/api/v1/deliveries/${task.id}/accept`, undefined, 403);
  const mine = await vol.ok("GET", "/api/v1/deliveries");
  const myTask = mine.mine.find((t: any) => t.id === task.id);
  check(/^\d{6}$/.test(myTask.pickupCode), "volunteer receives the pickup code");
  await donor.ok("POST", `/api/v1/claims/${nc.claim.id}/handover`, { code: myTask.pickupCode });
  const ngoView = await ngo.ok("GET", `/api/v1/claims/${nc.claim.id}`);
  check(ngoView.claim.status === "IN_DELIVERY" && /^\d{6}$/.test(ngoView.claim.delivery.dropCode), "recipient sees drop code while in delivery");
  await vol.ok("POST", `/api/v1/deliveries/${task.id}/drop`, { code: ngoView.claim.delivery.dropCode });
  const delivered = await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } });
  const volBalance = (await vol.ok("GET", "/api/v1/billing/summary")).balance;
  check(delivered.status === "DELIVERED" && (delivered.stipendCents ?? 0) > 0 && volBalance === delivered.stipendCents, "delivery completes and pays a stipend from the fund");

  // ── Moderation ────────────────────────────────────────────────────────
  console.log("\nModeration");
  const { listing: l5 } = await donor.ok("POST", "/api/v1/listings", donation({ title: `Suspicious curry ${run}` }));
  for (const c of [alice, bob, carol]) await c.ok("POST", "/api/v1/reports", { targetType: "LISTING", targetId: l5.id, reason: "FOOD_SAFETY", details: "Smelled off" });
  const l5db = await db.listing.findUniqueOrThrow({ where: { id: l5.id } });
  check(l5db.status === "REMOVED", "three food-safety reports auto-pause the listing");
  await alice.fails("POST", "/api/v1/reports", { targetType: "LISTING", targetId: l5.id, reason: "FOOD_SAFETY" }, 409);

  // ── Time-based sweep ──────────────────────────────────────────────────
  console.log("\nSweep: no-shows, expired holds, expiry");
  const { listing: l6 } = await donor.ok("POST", "/api/v1/listings", donation({ title: `Late pickup ${run}`, quantityTotal: 5 }));
  const late = await carol.ok("POST", `/api/v1/listings/${l6.id}/claims`, { quantity: 1 });
  const hold = await bob.ok("POST", `/api/v1/listings/${l3.id}/claims`, { quantity: 1 });
  await db.listing.update({ where: { id: l6.id }, data: { pickupEnd: new Date(Date.now() - 60 * 60_000) } });
  await db.claim.update({ where: { id: hold.claim.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
  const cron = await fetch(`${BASE}/api/cron`, { headers: { authorization: `Bearer ${CRON}` } });
  check(cron.ok, "cron endpoint runs with the secret");
  check((await fetch(`${BASE}/api/cron`)).status === 401, "cron endpoint rejects callers without the secret");
  const [lateDb, holdDb, l6db, carolDb] = await Promise.all([
    db.claim.findUniqueOrThrow({ where: { id: late.claim.id } }),
    db.claim.findUniqueOrThrow({ where: { id: hold.claim.id } }),
    db.listing.findUniqueOrThrow({ where: { id: l6.id } }),
    db.user.findUniqueOrThrow({ where: { email: `carol-${run}@example.test` } }),
  ]);
  check(lateDb.status === "NO_SHOW" && carolDb.noShowStrikes === 1, "uncollected pickup becomes a no-show strike");
  check(holdDb.status === "EXPIRED", "unpaid hold expires and releases stock");
  check(l6db.status === "COMPLETED", "listing with a no-show closes as COMPLETED (counted, not wasted)");
  const lateNotif = await db.notification.count({ where: { user: { email: `carol-${run}@example.test` }, type: "claim.no_show" } });
  check(lateNotif === 1, "no-show user was told how many strikes remain");

  // Late webhook after the hold expired: stock is still there, so the claim revives.
  await bob.ok("POST", "/api/v1/payments/mock", { orderId: hold.checkout.orderId, outcome: "success" });
  const revived = await db.claim.findUniqueOrThrow({ where: { id: hold.claim.id } });
  check(revived.status === "CONFIRMED", "late payment re-reserves stock instead of losing the money");

  // ── Privacy ───────────────────────────────────────────────────────────
  console.log("\nPrivacy");
  const { listing: home } = await alice.ok("POST", "/api/v1/listings", donation({ title: `Home-cooked rajma ${run}`, lat: 28.613912, lng: 77.209023, address: "Flat 4B, Private Lane" }));
  const pub = await bob.ok("GET", `/api/v1/listings/${home.id}`);
  check(pub.listing.address === null && pub.listing.lat === 28.61, "individual donor's address hidden and coordinates fuzzed");
  const exp = await alice.req("GET", "/api/v1/me/export");
  check(exp.status === 200 && exp.json.email === `alice-${run}@example.test`, "data export returns the user's data");
  await alice.ok("DELETE", "/api/v1/me");
  const gone = await db.user.findUniqueOrThrow({ where: { id: me.user.id } });
  const homeDb = await db.listing.findUniqueOrThrow({ where: { id: home.id } });
  check(gone.status === "DELETED" && gone.email.startsWith("deleted+") && homeDb.status === "CANCELLED", "account deletion anonymises and withdraws listings");

  // ── Public impact & admin ────────────────────────────────────────────
  const impact = await anon.ok("GET", "/api/v1/impact");
  check(impact.platform.totals.kgSaved > 0 && impact.platform.sponsors.length > 0, "public impact page has totals and sponsors");
  const stats = await admin.ok("GET", "/api/v1/admin/stats");
  check(stats.revenue30 > 0 && stats.rescueFund > 0, "admin sees revenue and fund balance");

  console.log(`\nAll ${passed} checks passed ✔`);
}

main()
  .catch((err) => {
    console.error(`\n${err.message}\n(${passed} checks passed before failure)`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
