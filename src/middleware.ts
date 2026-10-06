import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "tamasha_session";

// First line of defence: redirect signed-out / wrong-role visitors before rendering.
// Every page layout and API route re-checks against the database, so this is only for UX.
const PROTECTED: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/organizer", roles: ["ORGANIZER"] },
  { prefix: "/tickets", roles: ["ATTENDEE", "ORGANIZER", "ADMIN"] },
  { prefix: "/orders", roles: ["ATTENDEE", "ORGANIZER", "ADMIN"] },
];

function secret() {
  const v = process.env.AUTH_SECRET;
  return new TextEncoder().encode(v && v.length >= 16 ? v : "dev-only-insecure-secret-do-not-use");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = PROTECTED.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let role: string | undefined;
  if (token) {
    try {
      role = (await jwtVerify(token, secret())).payload.role as string;
    } catch {
      role = undefined;
    }
  }
  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = role === "ADMIN" ? "/admin" : role === "ORGANIZER" ? "/organizer" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/organizer/:path*", "/tickets/:path*", "/orders/:path*"] };
