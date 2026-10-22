import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { submitVerification } from "@/lib/services/community";

const schema = z.object({
  documents: z
    .array(z.object({ docType: z.enum(["registration_certificate", "fssai_licence", "tax_exemption", "id_proof", "other"]), fileKey: z.string() }))
    .min(1)
    .max(5),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  const { documents } = await body(req, schema);
  await submitVerification(user, documents);
});
