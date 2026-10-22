# FoodShare Pro

A production-grade surplus-food rescue platform. Restaurants, bakeries, grocers, caterers and neighbours list surplus food; NGOs, shelters and people nearby reserve and collect it, or a volunteer delivers it. Donations are always free. The platform sustains itself through discounted surplus sales (commission), a Pro plan for businesses, corporate sponsorships that fund volunteer stipends, and optional tips.

It is the professional rebuild of the original `FOOD_SHARE_FINAL_PROJECT` (Express + MySQL + static HTML). It keeps the same idea (donors, recipients, claims, ratings, notifications, impact) and makes every feature end-to-end, safe, tested and cheap to run.

## What's inside

| Area | Features |
| --- | --- |
| **Listings** | Free donations or discounted surplus sales · photos (compressed in the browser) · diet type (veg/vegan/egg/non-veg) · allergens · storage · cooked-at / safe-until · pickup window · per-person cap · map pin · **food-safety rules enforced** (4-hour hot-food rule, pickup before safe-until, checklist for cooked food, ≥30% discount on sales) |
| **Discovery** | Geo search (closest first) with radius, category, diet-compatibility, allergen exclusion, free/deal filter · list + map view · saved **alerts** pushed when matching food is posted |
| **Claims** | Atomic reservation (no double-claiming of the last portion) · partial quantities · optional donor approval with 1-hour SLA · **6-digit handover code** proves pickup · in-claim chat · cancellations with automatic refunds · no-show strikes and temporary suspension |
| **NGO priority** | Verified NGOs get a head start (e.g. 30 min) and higher claim limits; donors can restrict large cooked batches to verified NGOs only |
| **Volunteer delivery** | Recipient asks for delivery → nearby volunteers notified → accept → collect with pickup code → deliver with recipient's drop code → stipend paid from the sponsor-funded **Rescue Fund** |
| **Trust & safety** | Document verification for NGOs/businesses (private storage, signed URLs) · reviews both ways · reports with auto-pause after 3 independent food-safety reports · moderation queue · audit log · fuzzed public location for home donors · phone numbers revealed only after confirmation |
| **Money** | Razorpay (India) / Stripe (global) / mock provider · append-only ledger · sellers credited **only at handover** · late-payment recovery · refunds · Pro subscriptions · sponsorships · tips · payout requests (manual UPI/bank: zero fees) |
| **Impact** | Per-rescue kg, meals and CO₂e from confirmed handovers only · personal and public impact pages · **donation certificates** (print-to-PDF) · CSR/ESG report with CSV export (Pro) |
| **Recurring** | Pro businesses auto-post the same surplus on chosen weekdays (e.g. a bakery's bread at closing time) |
| **Notifications** | In-app + free Web Push + email (transactional immediately, alerts batched into a daily digest) |
| **Admin** | KPIs and revenue · verification, reports and payouts queues · user moderation |
| **Privacy** | Data export and account deletion (GDPR / India DPDP Act 2023) · automatic retention clean-up |

## Stack (chosen for low running cost)

- **Next.js 15 + TypeScript**: UI and REST API in **one deployable**.
- **PostgreSQL + Prisma**: also the **job queue** (`FOR UPDATE SKIP LOCKED`) and **rate limiter**, so there is no Redis.
- **Tailwind CSS 4**, **Leaflet + OpenStreetMap** (no Google Maps bill), **Web Push** (no SMS bill).
- **S3-compatible storage** (Cloudflare R2: zero egress fees). The browser uploads directly with presigned URLs.
- **Payments:** Razorpay and Stripe are called over plain REST, with no SDKs.

See [docs/COST.md](docs/COST.md): about **$5–8/month** at launch and about **$150–250/month** at around 100k monthly users.

## Quick start

Prerequisites: Node 22 and Docker.

```bash
npm install
cp .env.example .env          # defaults work for local dev
npm run db:up                 # Postgres on :5433, Mailpit (email catcher) on :8025
npx prisma migrate deploy     # or: npm run db:push
npm run db:seed               # demo data; every password is "foodshare123"
npm run dev                   # http://localhost:3000
```

Demo accounts (seeded): `admin@`, `bistro@` (verified restaurant, Pro), `bakery@`, `shelter@` (verified NGO), `priya@` (individual), `vikram@` (volunteer), all at `foodshare.local`. Outgoing emails appear at http://localhost:8025.

Payments run in **mock mode** by default: checkout opens a local page where you can simulate success or failure.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm test` | 38 unit tests for the domain rules (state machines, pricing, fairness, food safety, schedules, geo, webhook signatures) |
| `npm run smoke` | **52-check end-to-end test** against a running server: every cross-feature flow, as multiple users |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | Demo data |
| `npm run vapid` | Generate Web Push keys |

## Project layout

```
prisma/              schema, migrations, seed
src/lib/domain/      pure business rules (no I/O) — unit-tested
src/lib/services/    use-cases: listings, claims, billing, community, impact, alerts, schedules, account, admin
src/lib/payments/    razorpay | stripe | mock behind one interface
src/lib/jobs/        Postgres job queue + time-based sweep (expiry, no-shows, reminders, renewals)
src/app/api/v1/      REST API (thin handlers over services)
src/app/             pages: public, (auth), dashboard, admin
scripts/smoke.ts     end-to-end test
deploy/              production docker-compose, Caddy, backups
docs/                architecture, scenarios, business model, cost, deployment, API
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the pieces connect, state machines, data model
- [Scenarios](docs/SCENARIOS.md): 100+ edge cases and exactly how each is handled and tested
- [Business model](docs/BUSINESS_MODEL.md): revenue streams, pricing logic, unit economics
- [Cost](docs/COST.md): monthly cost by growth stage and the design choices behind it
- [Deployment](docs/DEPLOYMENT.md): VPS and serverless paths, payments, storage, go-live checklist
- [API](docs/API.md): endpoint reference

## What changed from the original project

| Original | FoodShare Pro |
| --- | --- |
| 6 parallel copies (Express, static HTML, half-done Next.js) | One coherent app |
| MySQL events + node-cron inside the web process | Idempotent sweep driven by an in-process timer or an external free cron |
| Twilio SMS | Free Web Push + batched email |
| Uploads on local disk | R2/S3 direct uploads, compressed client-side |
| Claim = row insert (race conditions, over-claiming) | Atomic stock reservation, state machine, handover codes |
| No food-safety enforcement | Time/temperature rules, checklist, reports, auto-pause |
| Forum / events / educational CMS (high moderation cost) | Per-claim chat, static guides (zero runtime cost) |
| No revenue | Commission, Pro plan, sponsorships, tips, all with a ledger |
| Secrets committed in `.env` | `.env.example` only; secrets via environment |
