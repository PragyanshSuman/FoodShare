import type { Prisma } from "@prisma/client";
import { db, type Tx } from "../db";

export type JobType = "email.send" | "push.send" | "alerts.match" | "digest.daily";

/** Enqueue inside the caller's transaction when given one, so jobs commit atomically with the change. */
export async function enqueue(type: JobType, payload: Prisma.InputJsonValue, opts: { runAt?: Date; tx?: Tx } = {}) {
  const client = opts.tx ?? db;
  await client.job.create({ data: { type, payload, runAt: opts.runAt ?? new Date() } });
}

type Handler = (payload: any) => Promise<void>;

/**
 * Claim due jobs with FOR UPDATE SKIP LOCKED so several instances (or an
 * overlapping cron call) never run the same job twice.
 */
export async function runDueJobs(handlers: Record<JobType, Handler>, limit = 25) {
  const jobs = await db.$queryRaw<{ id: string; type: JobType; payload: unknown; attempts: number; maxAttempts: number }[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = now(), "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'PENDING' AND "runAt" <= now())
         OR ("status" = 'RUNNING' AND "lockedAt" < now() - interval '10 minutes')
      ORDER BY "runAt" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "payload", "attempts", "maxAttempts"`;

  let done = 0;
  for (const job of jobs) {
    try {
      const handler = handlers[job.type];
      if (!handler) throw new Error(`No handler for ${job.type}`);
      await handler(job.payload);
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null } });
      done++;
    } catch (err) {
      const failed = job.attempts >= job.maxAttempts;
      const backoffSec = 30 * 2 ** job.attempts;
      await db.job.update({
        where: { id: job.id },
        data: {
          status: failed ? "FAILED" : "PENDING",
          lockedAt: null,
          lastError: String((err as Error)?.message ?? err).slice(0, 500),
          runAt: new Date(Date.now() + backoffSec * 1000),
        },
      });
      console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts})`, err);
    }
  }
  return { picked: jobs.length, done };
}
