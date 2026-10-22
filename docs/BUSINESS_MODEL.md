# Business model

**Principle:** whoever gives or receives food for free never pays. Revenue comes from businesses that *gain* from the platform (recovered money, saved staff time, CSR reporting) and from companies that want measurable social impact.

## Revenue streams (all implemented)

| # | Stream | Who pays | How it works | Code |
|---|---|---|---|---|
| 1 | **Surplus-sale commission** | Food businesses | Verified businesses sell end-of-day surplus at ≥ 30% off (like Too Good To Go). Buyer pays upfront; seller is credited price − commission **at handover**. Commission: 15% Free, 10% Pro, 7% Enterprise. | `domain/pricing.ts`, `services/billing.ts` |
| 2 | **Pro subscription** | Food businesses | ₹999/mo or ₹9,990/yr (USD 19 / 190). Unlocks recurring listings, multi-location, CSR/ESG reports + CSV, 100 active listings, lower commission. Prepaid, no auto-debit. | `config.ts` `PLANS`, `PLAN_PRICES` |
| 3 | **Rescue Fund sponsorships** | Companies (CSR budgets) | Sponsor N deliveries (₹60 each). 90% goes to volunteer stipends, 10% platform fee. Sponsors are listed on the public impact page. | `createSponsorshipOrder()`, `payStipend()` |
| 4 | **Buyer tips** | Buyers (optional) | One-tap tip at checkout ("keep FoodShare free for NGOs"). | `ClaimPanel`, `saleBreakdown()` |
| 5 | **Supporter contributions** | Anyone (optional) | One-off donations from the billing page. | `createTipOrder()` |
| 6 | **Enterprise** (sales-led) | Chains, hotel groups, corporate cafeterias | Custom: 7% commission, 500 locations, API/POS integration, onboarding. | `PLANS.ENTERPRISE` |

### Why these, and not others

- **No ads, no data sales.** They would erode trust with vulnerable recipients and NGOs, which is the platform's main asset.
- **No fees for NGOs or recipients.** The free side drives the liquidity that businesses pay for.
- **No SMS-alert premium tier.** SMS is the biggest variable cost in comparable apps; we replaced it with free Web Push.
- **Prepaid Pro instead of auto-debit.** In India, RBI e-mandate rules make recurring card debits fiddly (pre-debit notifications, limits). Prepaid periods with reminder emails cost nothing to build and run.
- **Manual payouts first.** Batch UPI/bank transfers cost ₹0. Move to RazorpayX / Stripe Connect only when payout volume makes manual work expensive.

## Why businesses pay

| Value to a restaurant / bakery | Mechanism |
|---|---|
| Recover 30–70% of the cost of food that would be binned | Surplus sales |
| Less staff time | Recurring listings post automatically at closing time |
| Proof for CSR / ESG / tax filings | Certificates per rescue; date-range reports; CSV export |
| Brand | Verified + Pro badges; sponsors on the impact page |
| Zero disputes | Paid only after a code-verified handover; buyer no-shows still pay |

## Illustrative unit economics (one mid-size Indian city, year 2)

These are **assumptions to test**, not forecasts.

| Driver | Assumption | Monthly |
|---|---|---|
| Surplus sales | 3,000 bags × ₹120 avg × 12% blended commission | ₹43,200 |
| Pro subscribers | 30 businesses × ₹999 | ₹29,970 |
| Sponsorships | ₹1.5 lakh/quarter CSR → 10% fee | ₹5,000 |
| Tips & contributions | ~5% of buyers × ₹20 + occasional gifts | ₹5,000 |
| **Revenue** | | **≈ ₹83,000 (~US$1,000)** |
| Payment processing | ~2% of ₹3.6 lakh GMV + subscription/sponsor volume | −₹8,500 |
| Infrastructure | VPS + email + storage + maps (see COST.md) | −₹1,500 to −₹3,000 |
| **Contribution before people costs** | | **≈ ₹71,000** |

Volunteer stipends are paid from sponsor money, not from revenue, so delivery cost scales with sponsorship rather than with the platform's margin.

### Break-even levers (in order of impact)

1. **Liquidity in one city first.** Commission revenue is GMV-driven; dense supply near demand beats wide shallow coverage.
2. **Convert repeat sellers to Pro.** Above about 70 sales/month at ₹120, a business saves more in commission (5 points) than Pro costs, so Pro sells itself. The dashboard shows commission paid.
3. **CSR partnerships.** India's Companies Act Schedule VII lists eradicating hunger as an eligible CSR activity, which makes sponsorships an easy sell to corporates.
4. **Enterprise chains.** One hotel group can equal 50 independent restaurants.

## Metrics to watch (all on `/admin`)

- Completion rate (claims → completed): target > 80%. No-shows kill donor trust.
- Time-to-claim for new listings, and the share of listings that expire unclaimed.
- GMV and revenue by source; Rescue Fund balance against delivery demand.
- Verification queue age; open food-safety reports (target: zero older than 24 h).
