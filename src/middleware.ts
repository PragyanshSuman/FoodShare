import { NextResponse, type NextRequest } from "next/server";

// Cheap edge check: bounce signed-out visitors before rendering private pages.
// Real session validation still happens server-side on every request.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("fs_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/certificates/:path*", "/checkout/:path*"] };
