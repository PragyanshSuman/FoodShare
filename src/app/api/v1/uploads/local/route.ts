import { api } from "@/lib/http";
import { acceptLocalUpload } from "@/lib/storage";

// Local-driver stand-in for an S3 presigned PUT. The HMAC in the query is the authorisation.
export const PUT = api(async (req) => {
  await acceptLocalUpload(new URL(req.url).searchParams, await req.arrayBuffer());
});
