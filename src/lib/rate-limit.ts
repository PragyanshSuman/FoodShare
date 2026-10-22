import { db } from "./db";
import { tooMany } from "./errors";

/**
 * Fixed-window limiter stored in Postgres: one atomic upsert per call, works
 * across multiple instances, and costs nothing extra (no Redis).
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit) throw tooMany();
}
