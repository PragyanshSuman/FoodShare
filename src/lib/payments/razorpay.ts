import { env } from "../env";
import { hmacHex, safeEqual } from "../crypto";
import type { PaymentProvider } from "./index";

// Razorpay: UPI/cards/netbanking for India at ~2% MDR, no monthly fee.
const API = "https://api.razorpay.com/v1";
const auth = () => "Basic " + Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Razorpay ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Signature the Checkout widget returns to the browser after payment. */
export function verifyRazorpayCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  return safeEqual(hmacHex(`${orderId}|${paymentId}`, env.razorpayKeySecret), signature);
}

export const razorpayProvider: PaymentProvider = {
  name: "razorpay",
  async createCheckout(input) {
    const order = await call<{ id: string }>("/orders", {
      amount: input.amountCents,
      currency: input.currency,
      receipt: input.orderId,
      notes: { orderId: input.orderId },
    });
    return {
      providerOrderId: order.id,
      clientPayload: {
        key: env.razorpayKeyId,
        order_id: order.id,
        amount: input.amountCents,
        currency: input.currency,
        name: "FoodShare",
        description: input.description,
        prefill: { email: input.customerEmail },
        callbackSuccess: input.successUrl,
      },
    };
  },
  async parseWebhook(rawBody, headers) {
    const sig = headers.get("x-razorpay-signature") ?? "";
    if (!env.razorpayWebhookSecret || !safeEqual(hmacHex(rawBody, env.razorpayWebhookSecret), sig)) {
      throw new Error("Invalid Razorpay signature");
    }
    const evt = JSON.parse(rawBody) as {
      event: string;
      payload: { payment?: { entity: { id: string; order_id: string } } };
    };
    const payment = evt.payload.payment?.entity;
    if (!payment) return null;
    if (evt.event === "payment.captured" || evt.event === "order.paid")
      return { type: "paid", providerOrderId: payment.order_id, providerPaymentId: payment.id };
    if (evt.event === "payment.failed") return { type: "failed", providerOrderId: payment.order_id };
    return null;
  },
  async refund(providerPaymentId, amountCents) {
    await call(`/payments/${providerPaymentId}/refund`, { amount: amountCents });
  },
};
