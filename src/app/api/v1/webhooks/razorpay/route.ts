import { razorpayProvider } from "@/lib/payments/razorpay";
import { handleWebhook } from "../shared";

export const POST = (req: Request) => handleWebhook(req, razorpayProvider);
