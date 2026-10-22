import { env } from "../env";
import { runCron } from "./cron";

export function startInternalCron() {
  if (!env.internalCron) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runCron();
    } catch (err) {
      console.error("[cron] tick failed", err);
    } finally {
      running = false;
    }
  };
  setInterval(tick, 60_000).unref?.();
  setTimeout(tick, 5_000);
  console.info("[cron] internal scheduler started");
}
