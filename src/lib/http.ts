import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, badRequest, forbidden } from "./errors";
import { env } from "./env";

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: consistent JSON errors, CSRF origin check for
 * cookie-authenticated mutations, and no stack traces leaking to clients.
 */
export function api<P = Record<string, string>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      const result = await fn(req, ctx);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input",
          details: err.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return NextResponse.json({ error: { code: "CONFLICT", message: "That already exists" } }, { status: 409 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be JSON");
  }
  return schema.parse(raw);
}

export function query<S extends ZodTypeAny>(req: Request, schema: S): z.output<S> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}

/**
 * Client IP for rate limiting. Prefer headers our own proxy sets (Cloudflare /
 * Caddy `X-Real-IP`); for X-Forwarded-For take the right-most hop, because the
 * left-most entries are supplied by the client and trivially spoofed.
 */
export function clientIp(req: Request) {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "local"
  );
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (webhooks, curl) carry no cookies cross-site
  const allowed = new Set([env.appUrl, new URL(req.url).origin]);
  if (!allowed.has(origin)) throw forbidden("Cross-origin request blocked");
}
