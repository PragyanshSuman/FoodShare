import type { PaymentProvider } from "@/lib/payments";
import { markOrderFailed, markOrderPaid } from "@/lib/services/billing";

/**
 * Providers retry on non-2xx, so: 400 for bad signatures (never retried
 * successfully), 500 for our own failures (retry later), 200 otherwise.
 */
export async function handleWebhook(req: Request, provider: PaymentProvider) {
  const raw = await req.text();
  let event;
  try {
    event = await provider.parseWebhook(raw, req.headers);
  } catch (err) {
    console.warn(`[webhook:${provider.name}] rejected`, (err as Error).message);
    return new Response("invalid signature", { status: 400 });
  }
  if (!event) return new Response("ignored", { status: 200 });
  try {
    if (event.type === "paid") await markOrderPaid({ providerOrderId: event.providerOrderId }, event.providerPaymentId);
    else await markOrderFailed(event.providerOrderId);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(`[webhook:${provider.name}] processing failed`, err);
    return new Response("error", { status: 500 });
  }
}
