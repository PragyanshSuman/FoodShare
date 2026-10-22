# Scenario catalogue

Every scenario below is handled in code. **Test** column: `U` = unit test (`tests/domain.test.ts`), `E` = end-to-end smoke test (`scripts/smoke.ts`), `—` = enforced in code but not yet covered by an automated test.

## 1. Accounts & identity

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 1 | Sign-up with an existing email | 409, no account created | `services/auth.ts` | — |
| 2 | Business/NGO signs up | Organisation created with the user in one transaction | `signup()` | E |
| 3 | Unverified email tries to post or claim | Blocked with a clear message; resend link available (3/hour) | `listings.ts`, `fairness.ts` | E, U |
| 4 | Wrong password / unknown email | Same 401 and similar timing; per-IP and per-email rate limits | `login()`, `/auth/login` | E |
| 5 | Brute-force or credential stuffing | 20 tries / 15 min per IP, 8 per account | `rate-limit.ts` | E (signup limit) |
| 6 | Password reset requested for an unknown email | Same success response (no account enumeration) | `requestPasswordReset()` | — |
| 7 | Reset link reused or expired | Rejected; older links invalidated when a new one is issued | `consumeToken()` | — |
| 8 | Password changed | All sessions revoked | `resetPassword()` | — |
| 9 | Session stolen from the DB | Useless: only the SHA-256 of the token is stored | `session.ts` | — |
| 10 | Suspension period ends | Auto-reactivated by the sweep or at next login | `sweep()`, `login()` | — |
| 11 | Account deleted | Listings withdrawn, claims cancelled (refunds), PII anonymised, history kept | `account.ts` | E |
| 12 | Account deletion with unpaid balance | Blocked until the balance is withdrawn | `deleteAccount()` | — |
| 13 | User exports their data | JSON download (GDPR art. 15 / DPDP s.11), 3 per hour | `/me/export` | E |

## 2. Listings & food safety

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 14 | Hot food listed for more than 4 h after cooking | Rejected | `listing-rules.ts` | U, E |
| 15 | Prepared meal at room temperature for more than 24 h; chilled for more than 48 h | Rejected | `listing-rules.ts` | — |
| 16 | Pickup window ends after the safe-until time | Rejected | `listing-rules.ts` | U |
| 17 | Cooked food without the hygiene checklist or cooking time | Rejected | `listing-rules.ts` | U |
| 18 | Window in the past, inverted, or more than 14 days ahead | Rejected | `listing-rules.ts` | — |
| 19 | Donation with a price | Rejected | `listing-rules.ts` | U |
| 20 | Sale under 30% discount, or without an original price | Rejected (prevents disguised full-price trading) | `listing-rules.ts` | U, E |
| 21 | Individual or unverified business tries to sell | 403: selling needs a verified licence (FSSAI etc.) | `createListing()` | E |
| 22 | Paid listing that requires manual approval | Rejected (buyer would pay for an uncertain claim) | `listing-rules.ts` | U |
| 23 | Plan's active-listing limit reached | 403 with an upgrade message | `createListing()` | — |
| 24 | Photo keys from another user injected | Filtered: only `public/listing/<ownerId>/` keys accepted | `createListing()` | — |
| 25 | Organisation pickup location chosen | Address/coords snapshotted; later edits don't move live listings | `createListing()` | — |
| 26 | Donor edits a listing while people hold reservations | Only description, instructions, extending pickup and adding stock allowed | `updateListing()` | — |
| 27 | Donor reduces quantity below what's reserved | 409 | `updateListing()` | — |
| 28 | Donor withdraws a listing | All open claims cancelled + refunded + notified | `cancelListing()` | E (via deletion) |
| 29 | Listing reaches its deadline with nothing collected | `EXPIRED` | `deriveListingStatus()`, sweep | U |
| 30 | Partly collected at the deadline | `COMPLETED` (counted as rescued, not wasted) | `deriveListingStatus()` | U, E |
| 31 | Unclaimed food 60 min before the end | Donor nudged; NGO priority dropped; re-broadcast to all alerts | sweep step 7 | — |
| 32 | Home donor's address | Public sees ~1 km fuzzed point; exact address only after confirmation | `toListingView()` | E |
| 33 | NGO-only listing viewed by the public | Hidden from search and detail (404) | `searchListings()`, `getListingForViewer()` | — |

## 3. Discovery & alerts

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 34 | Search near me | Bounding box + haversine, closest first, radius ≤ 50 km | `searchListings()` | E |
| 35 | Vegan searching | Only vegan food; a vegetarian search also includes vegan, etc. | diet compatibility map | E |
| 36 | Allergy sufferer | Excludes listings containing chosen allergens | `allergens && …` | E |
| 37 | Viewer's own listings | Excluded from search | `searchListings()` | — |
| 38 | No location permission | Falls back to profile home area, then the city default | `searchListings()`, browse | — |
| 39 | New listing matches saved alerts | Push now, email in the daily digest; max 200 recipients | `alerts.ts` | — |
| 40 | NGO priority window | NGOs alerted immediately; everyone else when the window opens (delayed job) | `matchAlerts()` | — |
| 41 | Geocoding abuse | Explicit "Find" only, cached forever, 20/10 min per IP (Nominatim policy) | `geocode.ts` | — |

## 4. Claims & fairness

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 42 | Two people claim the last portion at the same instant | Exactly one wins; the other gets 409 | atomic `updateMany` | E |
| 43 | Claim own listing | Blocked | `claimBlocker()` | U |
| 44 | Quantity above stock or per-person cap | Blocked with the exact limit | `claimBlocker()` | U, E |
| 45 | Hoarding | Active-claim limit (2 individual / 5 business / 25 verified NGO) and daily limit (3/10/60) | `claimBlocker()` | U |
| 46 | Unverified NGO account | Gets individual limits until verified | `claimBlocker()` | U |
| 47 | Public tries to claim during NGO priority | Blocked with a "opens shortly" message | `claimBlocker()` | U, E |
| 48 | Donor requires approval | `PENDING_APPROVAL`; donor approves or declines; no answer in 60 min → expires, stock returns | `decideApproval()`, sweep | — |
| 49 | Claimant cancels | Stock returns; donor notified | `cancelClaim()` | E |
| 50 | Claimant cancels while a volunteer is carrying the food | Blocked; asked to message the volunteer | `cancelClaim()` | — |
| 51 | Two actors change a claim simultaneously | Compare-and-set: the second gets "changed in the meantime" | `moveClaim()` | — |
| 52 | Handover with a wrong code | Rejected; attempts counted; locked after 5 | `checkCode()` | E |
| 53 | Correct code | `COMPLETED`, impact snapshot, completion counts, settlement, review prompts | `completeClaim()` | E |
| 54 | Collector never shows | 30 min after the window → `NO_SHOW`, strike, notified with strikes left | sweep step 3 | E |
| 55 | Third no-show | 14-day claiming suspension, strikes reset | `applyNoShowStrike()` | U |
| 56 | Pickup reminder | 60 min before the window closes, once | sweep step 6 | — |
| 57 | Outsider requests a claim | 404 (no existence leak) | `getClaimForViewer()` | E |
| 58 | Pickup code visibility | Only the collector (claimant or volunteer) sees it; the drop code only the recipient | `getClaimForViewer()` | E |
| 59 | Phone numbers | Shown only between parties while the claim is confirmed or in delivery | `getClaimForViewer()` | — |

## 5. Volunteer delivery

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 60 | Delivery requested beyond 15 km | Rejected | `createClaim()` | — |
| 61 | Donor disallows delivery | Rejected | `createClaim()` | — |
| 62 | Non-volunteer tries to accept | 403 | `acceptDelivery()` | E |
| 63 | Two volunteers accept at once | Atomic; second gets 409 | `acceptDelivery()` | — |
| 64 | Volunteer is the donor or recipient | Blocked (no self-dealing for stipends) | `acceptDelivery()` | — |
| 65 | Volunteer overloaded | Max 3 concurrent deliveries | `acceptDelivery()` | — |
| 66 | Volunteer drops out before pickup | Task reopens; recipient informed | `releaseDelivery()` | — |
| 67 | No volunteer by the end of the window | Claim expires with an apology | sweep step 2 | — |
| 68 | Volunteer accepted but never collected | Expires after the grace period | sweep step 4 | — |
| 69 | Delivered | Drop code verified → completed → stipend if the fund has money (advisory-locked) | `confirmDrop()`, `payStipend()` | E |
| 70 | Rescue Fund empty | Delivery still completes; no stipend; volunteer told | `payStipend()` | — |

## 6. Payments & money

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 71 | Buyer abandons checkout | Hold lapses after 15 min, stock returns | sweep step 1 | E |
| 72 | Provider API down at checkout | Hold released immediately, error shown | `createClaim()` | — |
| 73 | Duplicate webhook / browser callback + webhook | Idempotent: processed once | `markOrderPaid()` | E |
| 74 | Payment arrives after the hold expired, stock remains | Claim revived | `markOrderPaid()` | E |
| 75 | Payment arrives after the hold expired, sold out | Automatic full refund + notification | `markOrderPaid()` | — |
| 76 | Forged webhook | Signature check fails → 400 | `parseWebhook()` | U (Stripe) |
| 77 | Seller credited before handover | Never: settlement happens at handover / no-show | `settleClaim()` | E |
| 78 | Buyer cancels ≥ 60 min before the end | Full refund | `cancelClaim()` | E |
| 79 | Buyer cancels later | No refund; seller settled | `cancelClaim()` | U (eligibility) |
| 80 | Seller cancels / listing withdrawn / moderation removal | Full refund always | `cancelClaim()` | — |
| 81 | Paid no-show | Seller still paid | `markNoShow()` | — |
| 82 | Double payout request | Second rejected (balance minus pending payouts) | `requestPayout()` | E |
| 83 | Payout recorded | Ledger debited only when the admin enters the transfer reference | `processPayout()` | E |
| 84 | Pro renewed early | Time stacks on the current period | `extendPlan()` | U |
| 85 | Pro expires | 3-day reminder, then downgrade to Free; recurring schedules paused | sweep step 9 | — |
| 86 | Mock payments in production | Refused unless explicitly allowed | `getPaymentProvider()` | — |

## 7. Trust, safety & moderation

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 87 | Verification documents | Private storage, signed 5-min URLs for reviewers only | `storage.ts` | E |
| 88 | Verified org changes its legal name / registration number | Drops back to unverified | `PATCH /organization` | — |
| 89 | Three people report a listing for food safety | Auto-removed and claims refunded before human review | `createReport()` | E |
| 90 | Same person reports twice | 409 | `createReport()` | E |
| 91 | Report spam | 10 reports/hour per user | `createReport()` | — |
| 92 | Low rating (≤ 2★) | Flagged to moderators | `createReview()` | — |
| 93 | Review abuse | One review per party per claim, only after completion, within 14 days | `createReview()` | E |
| 94 | Moderator suspends a user | Sessions revoked, user notified | `/admin/users/:id` | — |
| 95 | Moderator acts on themselves / changes roles | Blocked; role changes admin-only | `/admin/users/:id` | — |
| 96 | Chat spam | 30 messages/min; closed on cancelled claims | `sendMessage()` | — |

## 8. Operations

| # | Scenario | Behaviour | Where | Test |
|---|---|---|---|---|
| 97 | Cron triggered twice concurrently | Jobs claimed with SKIP LOCKED; sweep steps idempotent | `queue.ts`, `cron.ts` | — |
| 98 | Worker dies mid-job | Lock considered stale after 10 min; retried with backoff, `FAILED` after 5 | `runDueJobs()` | — |
| 99 | Unauthenticated cron call | 401 | `/api/cron` | E |
| 100 | Push subscription revoked by the browser | Pruned on 404/410 | `push.ts` | — |
| 101 | SMTP not configured | Emails logged to the console (dev) | `email.ts` | — |
| 102 | Database growth on free tiers | Old jobs, read notifications, tokens, sessions and rate-limit rows purged automatically | sweep step 10 | — |
| 103 | Health monitoring | `/api/health` checks DB and job backlog | `/api/health` | E |

## Impact methodology

Impact is computed **only** from handovers confirmed with a code, using the donor's declared weight per unit:

- **Meals** = kg ÷ 0.5. Food banks commonly use about 1.1–1.2 lb (0.5 kg) per meal.
- **CO₂e** = kg × 2.5. This is a lifecycle average for avoided food waste, including landfill methane; published factors range from about 1.9 to 4.5 depending on the food mix.
- **Water** = kg × 1,000 L, a coarse average footprint.

All three factors live in `src/lib/config.ts` (`IMPACT`). Update them if you adopt a specific standard (e.g. WRAP, EPA WARM).

## Legal references

- India: Food Safety and Standards (Recovery and Distribution of Surplus Food) Regulations, 2019. Surplus-food distribution agencies register with FSSAI. Selling food requires FSSAI registration or a licence, hence verification before SALE.
- USA: Bill Emerson Good Samaritan Food Donation Act, as amended by the Food Donation Improvement Act (Public Law 117-362, 2023). It extends protection to qualified direct donors and to "good Samaritan reduced price" sales.
- Privacy: India Digital Personal Data Protection Act 2023; EU GDPR.

Have the terms and privacy pages reviewed by a lawyer before launch.
