import { env } from "../env";
import { hmacHex, safeEqual } from "../crypto";
import type { PaymentProvider } from "./index";

// Stripe Checkout via plain REST — no SDK in the bundle.
const API = "https://api.stripe.com/v1";

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Stripe-Signature: t=<ts>,v1=<hmac of "ts.body">; reject replays older than 5 minutes. */
export function verifyStripeSignature(rawBody: string, header: string, secret: string, now = Date.now()) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const ts = Number(parts.t);
  if (!ts || !parts.v1 || Math.abs(now / 1000 - ts) > 300) return false;
  return safeEqual(hmacHex(`${ts}.${rawBody}`, secret), parts.v1);
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(input) {
    const session = await call<{ id: string; url: string }>("/checkout/sessions", {
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      client_reference_id: input.orderId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": input.description,
      "expires_at": String(Math.floor(Date.now() / 1000) + 30 * 60),
    });
    return { providerOrderId: session.id, redirectUrl: session.url };
  },
  async parseWebhook(rawBody, headers) {
    const header = headers.get("stripe-signature") ?? "";
    if (!env.stripeWebhookSecret || !verifyStripeSignature(rawBody, header, env.stripeWebhookSecret)) {
      throw new Error("Invalid Stripe signature");
    }
    const evt = JSON.parse(rawBody) as { type: string; data: { object: { id: string; payment_intent?: string } } };
    const obj = evt.data.object;
    if (evt.type === "checkout.session.completed")
      return { type: "paid", providerOrderId: obj.id, providerPaymentId: obj.payment_intent };
    if (evt.type === "checkout.session.expired") return { type: "failed", providerOrderId: obj.id };
    return null;
  },
  async refund(providerPaymentId, amountCents) {
    await call("/refunds", { payment_intent: providerPaymentId, amount: String(amountCents) });
  },
};
