import { api } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { publicImpact, userImpact } from "@/lib/services/impact";

/** Public totals; adds the caller's personal impact when signed in. */
export const GET = api(async () => {
  const user = await getCurrentUser();
  const [platform, mine] = await Promise.all([publicImpact(), user ? userImpact(user.id) : null]);
  return new Response(JSON.stringify({ platform, mine }), {
    headers: { "content-type": "application/json", "cache-control": user ? "private, max-age=60" : "public, max-age=600" },
  });
});
