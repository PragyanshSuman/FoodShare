import { api } from "@/lib/http";
import { destroySession } from "@/lib/auth/session";

export const POST = api(async () => {
  await destroySession();
});
