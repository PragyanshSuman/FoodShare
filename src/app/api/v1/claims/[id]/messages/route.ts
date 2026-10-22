import { z } from "zod";
import { api, body } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { listMessages, sendMessage } from "@/lib/services/community";

type P = { id: string };

export const GET = api<P>(async (req, { params }) => {
  const user = await requireUser();
  const after = new URL(req.url).searchParams.get("after");
  return { messages: await listMessages(user, (await params).id, after ? new Date(after) : undefined) };
});

export const POST = api<P>(async (req, { params }) => {
  const user = await requireUser();
  const { body: text } = await body(req, z.object({ body: z.string() }));
  return { message: await sendMessage(user, (await params).id, text) };
});
