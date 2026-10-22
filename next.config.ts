import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
].join("; ");

const nextConfig: NextConfig = {
  // Self-contained server bundle → tiny Docker image, runs on any $5 VPS.
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["web-push", "nodemailer", "bcryptjs", "@prisma/client"],
  images: { unoptimized: true }, // Images are pre-compressed client-side; skip paid optimisation.
  // …so the native image library is dead weight in the server bundle (~45 MB).
  outputFileTracingExcludes: { "*": ["node_modules/@img/**", "node_modules/sharp/**", "node_modules/typescript/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
