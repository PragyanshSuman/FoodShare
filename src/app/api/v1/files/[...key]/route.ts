import { readLocalFile, verifyLocalGet } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const url = new URL(req.url);
  if (!verifyLocalGet(key, url.searchParams.get("expires"), url.searchParams.get("sig"))) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const file = await readLocalFile(key);
    return new Response(new Uint8Array(file), {
      headers: {
        "content-type": TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream",
        "cache-control": key.startsWith("private/") ? "private, no-store" : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
