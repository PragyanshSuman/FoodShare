import type { PaymentProvider } from "./index";

/** Dev/test provider: a local page lets you simulate success or failure. */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(input) {
    const providerOrderId = `mock_${input.orderId}`;
    return { providerOrderId, redirectUrl: `/checkout/mock?order=${input.orderId}` };
  },
  async parseWebhook() {
    return null; // the mock completes orders via /api/v1/payments/mock instead
  },
  async refund(providerPaymentId, amountCents) {
    console.info(`[payments:mock] refunded ${amountCents} on ${providerPaymentId}`);
  },
};
