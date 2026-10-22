# REST API (v1)

All endpoints take and return JSON. Authentication uses the `fs_session` cookie, set by sign-up or login. Errors have the shape `{ "error": { "code", "message", "details?" } }`, with HTTP 400 (validation), 401, 403, 404, 409 (state conflict), 429 (rate limited) or 500. Mutating requests from browsers must come from the app's own origin.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | `name, email, password, accountType (INDIVIDUAL\|BUSINESS\|NGO), organizationName?, organizationCategory?, isVolunteer?, acceptTerms` | Sends the verification email and signs in. 5/hour per IP |
| POST | `/api/v1/auth/login` | `email, password` | |
| POST | `/api/v1/auth/logout` | — | |
| POST | `/api/v1/auth/verify-email` | `token` | |
| POST | `/api/v1/auth/resend-verification` | — | 3/hour |
| POST | `/api/v1/auth/forgot-password` | `email` | Always 200 |
| POST | `/api/v1/auth/reset-password` | `token, password` | Revokes all sessions |

## Me

| Method | Path | Notes |
|---|---|---|
| GET / PATCH / DELETE | `/api/v1/me` | Profile + unread count / update prefs and home area / close account |
| GET | `/api/v1/me/export` | Full data export (JSON download) |
| GET | `/api/v1/me/listings` | Own listings |
| GET, POST · DELETE | `/api/v1/me/alerts` · `/api/v1/me/alerts/:id` | Saved searches (max 5) |
| GET · POST | `/api/v1/me/notifications` · `/api/v1/me/notifications/read` | `?before=` pagination · `{ ids? }` (omit = all) |
| POST / DELETE | `/api/v1/me/push` | Register / remove a Web Push subscription |

## Listings & discovery

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/listings?lat&lng&radiusKm&q&category&diet&mode&excludeAllergens=a,b&limit&offset` | Public; closest first |
| POST | `/api/v1/listings` | Create (see `listingSchema` in `src/lib/validation.ts`). Violations come back in `details.violations` |
| GET / PATCH / DELETE | `/api/v1/listings/:id` | Detail (privacy-aware) / edit / withdraw `{ reason }` |
| POST | `/api/v1/listings/:id/claims` | Reserve: `quantity, fulfilment, note?, dropAddress?, dropLat?, dropLng?, tipCents?` → `{ claim, checkout? }` |
| GET | `/api/v1/listings/:id/claims` | Donor only |
| GET | `/api/v1/geocode?q=` | Cached geocoding |
| POST | `/api/v1/uploads` | `{ purpose: listing\|avatar\|verification, contentType, size }` → `{ key, uploadUrl, headers }`, then PUT the bytes |

## Claims

| Method | Path | Body |
|---|---|---|
| GET | `/api/v1/claims` | — (`asRecipient`, `asDonor`) |
| GET | `/api/v1/claims/:id` | — (role-aware view) |
| POST | `/api/v1/claims/:id/approve` | `approve, reason?` (donor) |
| POST | `/api/v1/claims/:id/cancel` | `reason` |
| POST | `/api/v1/claims/:id/handover` | `code` (donor) |
| POST | `/api/v1/claims/:id/pay` | — resume checkout |
| GET / POST | `/api/v1/claims/:id/messages` | `?after=` / `body` |
| POST | `/api/v1/claims/:id/review` | `rating, tags?, comment?` |

## Volunteer deliveries

| Method | Path | Body |
|---|---|---|
| GET | `/api/v1/deliveries?lat&lng` | — (`open`, `mine`) |
| POST | `/api/v1/deliveries/:id/accept` · `/release` | — |
| POST | `/api/v1/deliveries/:id/drop` | `code` |

## Organisation, schedules, reports

| Method | Path | Body |
|---|---|---|
| GET / PATCH | `/api/v1/organization` | `name, category, description?, website?, phone?, registrationNumber?, taxExemptId?, payoutDetails?` |
| POST / DELETE | `/api/v1/organization/locations` | `label, address, city?, lat, lng, isDefault?` / `id` |
| POST | `/api/v1/organization/verification` | `documents: [{ docType, fileKey }]` |
| GET / POST | `/api/v1/schedules` | `listing (template), daysOfWeek, publishAt "HH:mm", pickupStartMin, pickupEndMin, expiresMin, tzOffsetMin` (Pro) |
| PATCH | `/api/v1/schedules/:id` | `active` |
| POST | `/api/v1/reports` | `targetType, targetId, reason, details?` |

## Billing & payments

| Method | Path | Body |
|---|---|---|
| GET | `/api/v1/billing/summary` | — plan, balance, ledger, orders, payouts |
| POST | `/api/v1/billing/subscribe` | `period: monthly\|yearly` → `{ checkout }` |
| POST | `/api/v1/billing/sponsor` | `amountCents, displayName, message?, website?` → `{ checkout }` |
| POST | `/api/v1/billing/tip` | `amountCents` → `{ checkout }` |
| POST | `/api/v1/billing/payouts` | `amountCents, destination` |
| POST | `/api/v1/payments/razorpay` | Razorpay widget callback (`razorpay_order_id, razorpay_payment_id, razorpay_signature`) |
| POST | `/api/v1/payments/mock` | `orderId, outcome` (mock provider only) |
| POST | `/api/v1/webhooks/razorpay` · `/api/v1/webhooks/stripe` | Provider-signed |

`checkout` = `{ orderId, provider, redirectUrl?, clientPayload? }`. Redirect to `redirectUrl` (Stripe, mock) or open Razorpay Checkout with `clientPayload`.

## Impact

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/impact` | Public totals + personal impact if signed in |
| GET | `/api/v1/impact/report?from&to` | CSV (Pro) |

## Admin (moderator / admin)

| Method | Path | Body |
|---|---|---|
| GET | `/api/v1/admin/stats` | — |
| GET / POST | `/api/v1/admin/verifications` · `/:orgId` | — / `approve, note?` |
| GET / POST | `/api/v1/admin/reports` · `/:id` | `?status=closed` / `action (dismiss\|remove_listing\|suspend_user\|warn_user), note, suspendDays?` |
| GET / POST | `/api/v1/admin/payouts` · `/:id` | admin only · `approve, reference?, note?` |
| GET / POST | `/api/v1/admin/users?q=` · `/:id` | `action (suspend\|unsuspend\|reset_strikes\|make_moderator\|make_user), days?, reason?` |

## Infrastructure

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/cron` | `Authorization: Bearer $CRON_SECRET` |
| GET | `/api/health` | DB status + job backlog |
