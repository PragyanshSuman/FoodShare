# Architecture

## Shape of the system

```
                     ┌──────────────────────────── one Next.js process ───────────────────────────┐
 Browser / PWA ──────►  Pages (server components)  ──┐                                          │
   │  ▲               Client components ── fetch ──► /api/v1/* route handlers (thin)             │
   │  │                                              │                                          │
   │  │                                              ▼                                          │
   │  │                               src/lib/services  (use-cases, transactions)               │
   │  │                                  │       │        │            │                        │
   │  │                    src/lib/domain (pure rules)    payments/   storage, email, push     │
   │  │                                  │                                                      │
   │  │                                  ▼                                                      │
   │  │                               PostgreSQL ◄── job queue (SKIP LOCKED) ◄── runCron()       │
   │  │                                  ▲                                         ▲            │
   │  └──── Web Push (browser vendor) ───┘                 in-process timer ──────┘            │
   │                                                       or /api/cron (external free cron)    │
   └──── direct PUT (presigned) ─────────────► Cloudflare R2 / S3                               │
                                         Razorpay / Stripe ──webhooks──► /api/v1/webhooks/*     │
                                                                                                │
```

**Rules of the layout**

1. `src/lib/domain/*` is pure: no database, no clock (time is passed in), no I/O. These are the business rules: state transitions, fees, fairness, food safety, impact, schedules. All 38 unit tests live here.
2. `src/lib/services/*` are the use-cases. Each mutation runs in one Postgres transaction, calls the domain rules, writes an audit row and enqueues side effects (notifications, alerts) **inside the same transaction**, so a rolled-back change never sends an email.
3. Route handlers only authenticate, validate (zod) and call a service. Pages read through the same services, so the UI and the API can never disagree.
4. External calls (payment providers, SMTP, push) happen **outside** transactions: after commit, or from the job queue.

## Key flows

### Reserving food (all modes)

```
POST /listings/:id/claims
  claimBlocker()                       ← fairness: suspension, email verified, own listing, NGO priority,
                                         audience, per-claim max, active/daily limits, window open
  BEGIN
    UPDATE listing SET qty = qty - n   ← WHERE status='ACTIVE' AND qty >= n   (atomic; loser gets 409)
    INSERT claim (status depends on mode)
      DONATION          → CONFIRMED  → onClaimConfirmed(): notify both, create DeliveryTask, ping volunteers
      DONATION+approval → PENDING_APPROVAL (hold 60 min)
      SALE              → PENDING_PAYMENT  (hold 15 min) + Order with fee breakdown
    syncListingStatus()
  COMMIT
  SALE → provider.createCheckout()     ← if this fails the hold is released immediately
```

### Claim state machine

```
PENDING_PAYMENT ──paid──► CONFIRMED ──handover code──► COMPLETED
      │                     │   └──volunteer collects──► IN_DELIVERY ──drop code──► COMPLETED
      ├─hold lapses─► EXPIRED ──late payment & stock left──► CONFIRMED
      └─cancel──► CANCELLED      ├─window+30 min passed─► NO_SHOW (strike; paid sale still settles)
PENDING_APPROVAL ─approve─► CONFIRMED │
      ├─decline─► REJECTED            └─cancel─► CANCELLED (refund per policy)
      └─60 min─► EXPIRED
```

Every transition goes through `moveClaim()`, which validates the transition and uses a compare-and-set update (`WHERE status = <expected>`), so concurrent actors can't both win. It returns stock when a held claim ends without handover and re-derives the listing status.

### Listing status is derived, never set ad hoc

`deriveListingStatus(current, qtyAvailable, activeClaims, completedClaims, pastDeadline)` → `ACTIVE | RESERVED | COMPLETED | EXPIRED`. Claim creation, cancellation, the sweep and payment webhooks all call `syncListingStatus()`, so they always agree.

### Money

- **Ledger, not balances.** `LedgerEntry` is append-only; an account's balance = `SUM(amountCents)`. Accounts: `user:<id>` (sellers, volunteers), `fund:rescue` (sponsor money), `platform:revenue`.
- **Settle at handover.** A paid sale credits the seller (price − commission) and the platform (commission + tip) only when the handover code is entered, or on a no-show. Refunds before handover therefore need no reversal, and a seller can't withdraw money for food that never changed hands.
- **Idempotent payments.** `markOrderPaid` flips `CREATED → PAID` with a conditional update, so duplicate webhooks and the browser callback racing the webhook are harmless.
- **Concurrency on shared accounts.** Stipends and payouts take a Postgres advisory lock on the account first (`pg_advisory_xact_lock(hashtext(account))`).

### Background work without extra infrastructure

| Mechanism | Used for |
| --- | --- |
| `Job` table + `FOR UPDATE SKIP LOCKED` | email, push, alert matching, daily digest; retries with exponential backoff; stale-lock recovery after 10 min |
| `sweep()` (every ~5 min) | expire holds, no-shows, unfilled deliveries, close listings, reminders, expiry warnings and re-broadcast, recurring listings, plan renewals/downgrades, housekeeping |
| Trigger | `ENABLE_INTERNAL_CRON=true` (VPS: a timer inside the server) **or** `GET /api/cron` with `Authorization: Bearer $CRON_SECRET` (serverless: GitHub Actions / cron-job.org) |

Every sweep step is bounded (`take: N`) and idempotent, so overlapping or repeated runs are safe.

## Data model (main tables)

| Table | Purpose |
| --- | --- |
| `User` | identity, account type, trust (rating, strikes, completed), notification prefs, home area |
| `Organization`, `Location`, `VerificationDocument` | businesses / NGOs, pickup sites, KYC documents, plan |
| `Listing`, `RecurringSchedule` | food on offer; schedule template for auto-posting |
| `Claim`, `DeliveryTask`, `Message`, `Review` | reservations, volunteer logistics, chat, ratings |
| `Order`, `LedgerEntry`, `Payout`, `Sponsorship` | payments and accounting |
| `Notification`, `PushSubscription`, `AlertPreference` | messaging and saved searches |
| `Report`, `AuditLog` | moderation and traceability |
| `Job`, `RateLimit`, `GeocodeCache`, `Session`, `AuthToken` | infrastructure in Postgres |

Geo queries use a bounding-box pre-filter on indexed `(status, lat, lng)` followed by exact haversine distance in SQL. That handles hundreds of thousands of listings without PostGIS; switch to PostGIS + GiST if you outgrow it.

## Security

- Sessions: random 256-bit token in an `HttpOnly; SameSite=Lax; Secure` cookie; only its SHA-256 is stored. Sliding 30-day expiry. Password reset signs out every device.
- CSRF: SameSite cookies plus an `Origin` check on every mutating API call.
- Passwords: bcrypt (cost 11), constant-time login path for unknown emails, per-IP and per-account rate limits.
- Rate limits stored in Postgres (multi-instance safe); client IP taken from proxy-set headers, never the spoofable left-most `X-Forwarded-For`.
- Uploads: type and size allow-list, HMAC-signed upload URLs, private KYC documents served only through short-lived signed URLs.
- Webhooks: HMAC signature verification (Razorpay, Stripe with 5-minute replay window).
- Privacy by default: fuzzed coordinates for home donors, phones and exact addresses revealed only after confirmation, handover codes shown only to the person who must present them.
- CSP, `nosniff`, `frame-ancestors 'none'`, strict referrer policy, HSTS (Caddy).
