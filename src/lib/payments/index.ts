import { env } from "../env";
import { mockProvider } from "./mock";
import { razorpayProvider } from "./razorpay";
import { stripeProvider } from "./stripe";

export type CheckoutInput = {
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResult = {
  providerOrderId: string;
  /** Hosted page to send the buyer to (Stripe, mock). */
  redirectUrl?: string;
  /** Data for an in-page widget (Razorpay Checkout). */
  clientPayload?: Record<string, unknown>;
};

export type WebhookEvent = {
  type: "paid" | "failed";
  providerOrderId: string;
  providerPaymentId?: string;
};

export interface PaymentProvider {
  name: "mock" | "razorpay" | "stripe";
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Verify signature and normalise the event. Returns null for events we ignore. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
  refund(providerPaymentId: string, amountCents: number): Promise<void>;
}

export function getPaymentProvider(): PaymentProvider {
  switch (env.paymentProvider) {
    case "razorpay":
      return razorpayProvider;
    case "stripe":
      return stripeProvider;
    default:
      if (env.isProd && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
        throw new Error("PAYMENT_PROVIDER=mock is disabled in production");
      }
      return mockProvider;
  }
}
