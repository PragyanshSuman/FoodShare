import { api, clientIp } from "@/lib/http";
import { badRequest, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { geocode } from "@/lib/geocode";

export const GET = api(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) throw badRequest("Type at least 3 characters");
  await rateLimit(`geocode:${clientIp(req)}`, 20, 600);
  const hit = await geocode(q);
  if (!hit) throw notFound("Address");
  return hit;
});
