import { redirect } from "next/navigation";
import { forbidden, unauthorized } from "../errors";
import { getCurrentUser, type CurrentUser } from "./session";

/** For API routes: throws 401 / 403. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") throw forbidden();
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden();
  return user;
}

/** For pages: redirects to login instead of throwing. */
export async function pageUser(next = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function pageStaff() {
  const user = await pageUser("/admin");
  if (!isStaff(user)) redirect("/dashboard");
  return user;
}

export const isStaff = (u: Pick<CurrentUser, "role">) => u.role === "ADMIN" || u.role === "MODERATOR";
