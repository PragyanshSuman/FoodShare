import { z } from "zod";
import { api, body } from "@/lib/http";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { forbidden, notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth/guards";
import { markOrderFailed, markOrderPaid } from "@/lib/services/billing";

/** Simulated payment gateway for development and demos. Disabled unless PAYMENT_PROVIDER=mock. */
export const POST = api(async (req) => {
  if (env.paymentProvider !== "mock") throw forbidden("Mock payments are disabled");
  const user = await requireUser();
  const { orderId, outcome } = await body(req, z.object({ orderId: z.string(), outcome: z.enum(["success", "failure"]) }));
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== user.id) throw notFound("Order");
  if (outcome === "success") await markOrderPaid({ orderId }, `mockpay_${orderId}`);
  else if (order.providerOrderId) await markOrderFailed(order.providerOrderId);
  return { status: outcome };
});
