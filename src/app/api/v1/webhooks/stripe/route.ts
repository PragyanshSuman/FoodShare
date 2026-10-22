import { stripeProvider } from "@/lib/payments/stripe";
import { handleWebhook } from "../shared";

export const POST = (req: Request) => handleWebhook(req, stripeProvider);
