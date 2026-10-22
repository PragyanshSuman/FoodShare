# Running cost

## Monthly cost by stage

Prices checked October 2026 from public pricing pages and third-party summaries; verify before committing. "MAU" = monthly active users.

| Item | Launch (< 2k MAU) | Growth (~10k MAU) | Scale (~100k MAU) |
|---|---|---|---|
| App + Postgres | 1 VPS, 2 vCPU / 4 GB (e.g. Hetzner CX22): **≈ €4–6** | 4 vCPU / 8 GB VPS **≈ €8–15**, or app VPS + Neon Launch (usage-based, ~$0.106/CU-h) | 2 app nodes behind a load balancer + managed Postgres: **≈ $80–150** |
| Photos (Cloudflare R2) | Free tier: 10 GB, 1M writes, 10M reads, **free egress** → **$0** | ~20 GB → **≈ $0.15** | ~200 GB → **≈ $3** |
| Email | Resend / Brevo free tiers (alerts batched into one digest/day) → **$0** | ~30k emails → **≈ $20** | ~200k → **≈ $50–90** |
| Push notifications | Web Push → **$0** at any volume | $0 | $0 |
| Maps | OSM tiles for light dev use; MapTiler / Stadia free tier → **$0** | Free tier or Protomaps file on R2 → **$0–5** | Self-hosted Protomaps on R2 → **≈ $5** |
| Geocoding | Nominatim + permanent DB cache → **$0** | $0 | Self-host Photon on the VPS → $0 |
| Domain + TLS | ~$1/mo (TLS free via Caddy / Let's Encrypt) | ~$1 | ~$1 |
| Monitoring | UptimeRobot / Better Stack free + `/api/health` → $0 | $0 | ~$20 |
| Backups | pg_dump nightly → R2 → $0 | $0 | Managed PITR (included) |
| **Total fixed** | **≈ $5–8 / month** | **≈ $30–50 / month** | **≈ $150–250 / month** |
| Payments (variable) | Razorpay ~2% per transaction (UPI often lower); Stripe ~2.9% + 30¢ (US). No monthly fee. Covered by commission. | | |

**$0 pilot option:** Neon free tier (0.5 GB, autosuspend after 5 min idle) plus a free hosting tier, with `/api/cron` called by the included GitHub Actions workflow. Check your host's terms before enabling paid features: Vercel's Hobby plan, for example, is non-commercial only. Move to the VPS when you start charging.

## Design decisions that keep the bill small

| Decision | Cost avoided |
|---|---|
| **One deployable** (Next.js serves UI and API) | Second service, inter-service networking |
| **Postgres does everything**: job queue (SKIP LOCKED), rate limiting, geocode cache, sessions | Redis / SQS / managed queue ($10–50+/mo) |
| **No websockets**: notifications poll once a minute *only when the tab is visible*; chat every 10 s only while open | Always-on connection servers / Pusher |
| **Web Push instead of SMS/OTP** | SMS at ₹0.15–0.25 or $0.0079+ per message × every alert |
| **Daily email digest** for alerts; immediate email only for transactional events | 10–50× email volume |
| **Images compressed in the browser** (≤ 1280 px WebP, ~150 KB) and **uploaded directly to R2** with presigned URLs | Server bandwidth, image-processing CPU, Next.js image optimisation fees |
| **R2 for storage** | S3 egress ($0.09/GB): photos are read far more often than written |
| **Leaflet + OSM-based tiles; geocode only on explicit click, cached forever** | Google Maps Platform (~$7 per 1,000 dynamic map loads beyond the free credit) |
| **Bounding-box + haversine** on indexed lat/lng | PostGIS isn't required, so every cheap Postgres host works |
| **Print-to-PDF** certificates and reports | PDF rendering service / headless Chrome |
| **Static content** (guides, legal) built at compile time | CMS subscription and moderation effort (the original forum/events/blog) |
| **No payment SDKs** (plain REST to Razorpay/Stripe) | Bundle size, cold starts |
| **In-memory 10-minute cache** of public impact stats | Repeated aggregate queries |
| **Automatic data retention** (jobs, read notifications, tokens, sessions, rate-limit rows) | Outgrowing free/cheap DB storage tiers |
| **Manual payouts via UPI/bank** until volume justifies automation | Payout-API fees and minimums |
| **Standalone Next.js build** in an Alpine image (~500 MB uncompressed, unused native image libraries excluded) | Bigger instances, slow deploys |

## When to upgrade what

| Signal | Action |
|---|---|
| p95 API latency > 500 ms or CPU > 70% sustained | Bigger VPS, then a second app node (sessions and rate limits already live in Postgres, so it's stateless) |
| DB > 70% of RAM, or slow geo queries | Managed Postgres; add PostGIS + GiST if listings exceed ~500k |
| Text search slow | `CREATE EXTENSION pg_trgm` + GIN index on `title` / `description` |
| > 50 payouts / week | RazorpayX Payouts / Stripe Connect |
| Map tile limits hit | Protomaps PMTiles file on R2 (one file, ~$0) |
