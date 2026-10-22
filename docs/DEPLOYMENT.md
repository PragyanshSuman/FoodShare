# Deployment

## Path A: a single VPS (recommended; about €5/month)

Everything (app, Postgres, HTTPS, nightly backups) runs on one machine with Docker.

1. Create a 2 vCPU / 4 GB Ubuntu VPS. Point your domain's A record at it. Install Docker.
2. Clone the repo and create `.env.production` from `.env.example`:
   ```bash
   APP_URL=https://foodshare.example.org
   DOMAIN=foodshare.example.org
   POSTGRES_PASSWORD=<long random>
   APP_SECRET=<openssl rand -hex 32>
   CRON_SECRET=<openssl rand -hex 24>
   NEXT_PUBLIC_CURRENCY=INR
   PAYMENT_PROVIDER=razorpay          # see "Payments" below
   STORAGE_DRIVER=s3                  # see "Storage" below
   SMTP_URL=smtps://resend:<api key>@smtp.resend.com:465
   EMAIL_FROM="FoodShare <hello@foodshare.example.org>"
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # npm run vapid
   VAPID_PRIVATE_KEY=...
   ```
3. Start it:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
   ```
   Migrations run automatically on boot. Caddy obtains TLS certificates. The internal scheduler runs the job loop.
4. Create the first admin: sign up normally, then
   `docker compose -f deploy/docker-compose.prod.yml exec db psql -U foodshare -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.org';"`
5. Off-site backups: sync the `backups` volume to R2 nightly with `rclone`.

## Path B: serverless (Netlify / Render / Fly / Vercel Pro) with managed Postgres

1. Provision Postgres (Neon / Supabase). Set `DATABASE_URL` (use the **pooled** connection string) and run `npx prisma migrate deploy` once.
2. Set the same env vars as above with `ENABLE_INTERNAL_CRON=false`.
3. Enable `.github/workflows/cron.yml` with repo secrets `APP_URL` and `CRON_SECRET`. It calls `/api/cron` every 5 minutes for free.
4. `STORAGE_DRIVER` must be `s3`: serverless disks are ephemeral.

## Payments

**Razorpay (India: UPI, cards, netbanking, wallets)**
1. Get API keys (Dashboard → Settings → API Keys) and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Add a webhook to `https://<domain>/api/v1/webhooks/razorpay` with events `payment.captured`, `order.paid` and `payment.failed`. Put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. `PAYMENT_PROVIDER=razorpay`. Checkout opens the Razorpay widget in-page. The browser callback confirms instantly; the webhook is the safety net.

**Stripe (global)**
1. Set `STRIPE_SECRET_KEY`.
2. Add a webhook to `https://<domain>/api/v1/webhooks/stripe` with events `checkout.session.completed` and `checkout.session.expired`. Put its secret in `STRIPE_WEBHOOK_SECRET`.
3. `PAYMENT_PROVIDER=stripe`. Buyers are redirected to Stripe Checkout.

Mock payments are refused in production unless `ALLOW_MOCK_PAYMENTS=true` (for staging only).

## Storage (Cloudflare R2)

1. Create a bucket and an API token with read/write access to it.
2. Make listing photos public: connect a custom domain (e.g. `cdn.example.org`) to the bucket, or enable the r2.dev URL.
3. Set `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PUBLIC_URL=https://cdn.example.org`.
4. Add a CORS rule allowing `PUT` from your `APP_URL` with the `content-type` header, so browsers can upload directly.
5. Verification documents live under `private/` and are only served through 5-minute signed URLs. Don't expose that prefix publicly.

## Maps

`NEXT_PUBLIC_MAP_TILE_URL` defaults to OpenStreetMap's tile servers. Those are fine for development, but their usage policy forbids heavy production use. For production use a MapTiler or Stadia key, or host a Protomaps PMTiles file on R2.

## Go-live checklist

- [ ] All secrets set; `.env` never committed (the original project committed Twilio keys — rotate them)
- [ ] `APP_URL` is https; cookies are `Secure` in production automatically
- [ ] Payment webhooks configured and tested with the provider's test mode
- [ ] R2 CORS rule added; photo upload tested from a phone
- [ ] VAPID keys set; push tested on Android Chrome and desktop
- [ ] Email domain verified (SPF/DKIM) with your SMTP provider
- [ ] Admin account created; moderators assigned
- [ ] Terms and privacy reviewed by a lawyer; FSSAI/local food-donation registration checked
- [ ] Uptime monitor on `/api/health`; backup restore tested once
- [ ] `npm test` and `npm run smoke` pass against staging
