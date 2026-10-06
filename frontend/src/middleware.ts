import { NextResponse, type NextRequest } from "next/server";

// First line of defence: send visitors without a session cookie to sign-in before rendering.
// The cookie is issued and verified by the backend; every page and API call re-checks role and
// ownership there, so this is only for a faster redirect.
const SESSION_COOKIE = "tamasha_session";

export function middleware(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/organizer/:path*", "/tickets/:path*", "/orders/:path*"] };
