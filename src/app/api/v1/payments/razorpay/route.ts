import { z } from "zod";
import { api, body } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { verifyRazorpayCheckoutSignature } from "@/lib/payments/razorpay";
import { markOrderPaid } from "@/lib/services/billing";

/**
 * The Razorpay widget calls back in the browser with a signed result. We
 * confirm immediately for snappy UX; the webhook is the safety net if the tab closes.
 */
export const POST = api(async (req) => {
  await requireUser();
  const p = await body(req, z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }));
  if (!verifyRazorpayCheckoutSignature(p.razorpay_order_id, p.razorpay_payment_id, p.razorpay_signature)) throw badRequest("Payment signature mismatch");
  await markOrderPaid({ providerOrderId: p.razorpay_order_id }, p.razorpay_payment_id);
});
