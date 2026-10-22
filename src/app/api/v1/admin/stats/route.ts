import { api } from "@/lib/http";
import { requireStaff } from "@/lib/auth/guards";
import { adminStats } from "@/lib/services/admin";

export const GET = api(async () => {
  await requireStaff();
  return adminStats();
});
