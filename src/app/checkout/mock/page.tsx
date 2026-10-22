import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { pageUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { Card, Notice } from "@/components/ui";
import { MockPay } from "./mock-pay";

/** Development stand-in for a hosted payment page (PAYMENT_PROVIDER=mock). */
export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  if (env.paymentProvider !== "mock") notFound();
  const user = await pageUser("/dashboard");
  const orderId = (await searchParams).order;
  const order = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
  if (!order || order.userId !== user.id) notFound();
  if (order.status === "PAID") redirect("/dashboard/billing?paid=1");
  const back = order.claimId ? `/dashboard/claims/${order.claimId}` : order.kind === "SPONSORSHIP" ? "/sponsor" : "/dashboard/billing";
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="space-y-4 text-center">
        <Notice tone="warn">Test mode — no real money moves.</Notice>
        <div className="text-sm text-muted">{order.kind.replace("_", " ").toLowerCase()}</div>
        <div className="text-4xl font-extrabold">{formatMoney(order.amountCents, order.currency)}</div>
        <MockPay orderId={order.id} back={back} />
      </Card>
    </div>
  );
}
