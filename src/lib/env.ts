// Centralised, typed access to environment variables.
const str = (key: string, fallback = "") => process.env[key] ?? fallback;

export const env = {
  isProd: process.env.NODE_ENV === "production",
  appUrl: str("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  appSecret: str("APP_SECRET", "dev-secret-change-me"),
  cronSecret: str("CRON_SECRET"),
  internalCron: str("ENABLE_INTERNAL_CRON", "false") === "true",

  currency: str("NEXT_PUBLIC_CURRENCY", "INR"),
  defaultLat: Number(str("NEXT_PUBLIC_DEFAULT_LAT", "28.6139")),
  defaultLng: Number(str("NEXT_PUBLIC_DEFAULT_LNG", "77.2090")),

  paymentProvider: str("PAYMENT_PROVIDER", "mock") as "mock" | "razorpay" | "stripe",
  razorpayKeyId: str("RAZORPAY_KEY_ID"),
  razorpayKeySecret: str("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: str("RAZORPAY_WEBHOOK_SECRET"),
  stripeSecretKey: str("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET"),

  storageDriver: str("STORAGE_DRIVER", "local") as "local" | "s3",
  s3Endpoint: str("S3_ENDPOINT"),
  s3Region: str("S3_REGION", "auto"),
  s3Bucket: str("S3_BUCKET"),
  s3AccessKeyId: str("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: str("S3_SECRET_ACCESS_KEY"),
  s3PublicUrl: str("S3_PUBLIC_URL").replace(/\/$/, ""),

  smtpUrl: str("SMTP_URL"),
  emailFrom: str("EMAIL_FROM", "FoodShare <no-reply@foodshare.local>"),

  vapidPublicKey: str("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  vapidPrivateKey: str("VAPID_PRIVATE_KEY"),
  vapidSubject: str("VAPID_SUBJECT", "mailto:admin@foodshare.local"),

  geocoderUrl: str("GEOCODER_URL", "https://nominatim.openstreetmap.org/search"),
  geocoderContact: str("GEOCODER_CONTACT", "admin@foodshare.local"),
};
