import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { exportAccount } from "@/lib/services/account";

export const GET = api(async () => {
  const user = await requireUser();
  await rateLimit(`export:${user.id}`, 3, 3600);
  const data = await exportAccount(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="foodshare-data-${user.id}.json"` },
  });
});
