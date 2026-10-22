import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runCron } from "@/lib/jobs/cron";

/**
 * For serverless deployments: hit this every 5 minutes from any free
 * scheduler (GitHub Actions, cron-job.org, Cloudflare Cron Triggers).
 */
async function handle(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!env.cronSecret || !safeEqual(token, env.cronSecret)) return new Response("unauthorized", { status: 401 });
  const result = await runCron({ forceSweep: true });
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
export const dynamic = "force-dynamic";
