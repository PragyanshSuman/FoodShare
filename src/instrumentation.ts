// Runs once per server process. On a single VPS/container this replaces an
// external scheduler: the job loop ticks every minute inside the app itself.
export async function register() {
  // This exact check lets Next.js drop the Node-only import from the edge bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInternalCron } = await import("./lib/jobs/internal-cron");
    startInternalCron();
  }
}
