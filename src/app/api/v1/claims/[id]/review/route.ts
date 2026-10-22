import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { reviewSchema } from "@/lib/validation";
import { createReview } from "@/lib/services/community";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const review = await createReview(user, (await params).id, await body(req, reviewSchema));
  return { review: { id: review.id } };
});
