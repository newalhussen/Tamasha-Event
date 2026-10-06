import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { ApiError, forbidden, unauthorized } from "./api";
import type { Role } from "./enums";

export const SESSION_COOKIE = "tamasha_session";
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set (16+ characters).");
    return new TextEncoder().encode("dev-only-insecure-secret-do-not-use");
  }
  return new TextEncoder().encode(value);
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function createSession(userId: string, role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string;
  role: Role;
  prefs: { smsReminder: boolean; emailFollowed: boolean; weeklyPicks: boolean };
  organizer: { id: string; name: string; slug: string; verified: boolean; status: string; payoutVerified: boolean } | null;
};

/** The signed-in user (fresh from the DB, so suspensions and role changes apply immediately). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    userId = payload.sub;
  } catch {
    return null;
  }
  const user = await db.user.findUnique({ where: { id: userId }, include: { organizer: true } });
  if (!user || user.status !== "ACTIVE") return null;
  let prefs = { smsReminder: true, emailFollowed: true, weeklyPicks: false };
  try {
    prefs = { ...prefs, ...JSON.parse(user.prefs) };
  } catch {
    /* keep defaults */
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    role: user.role as Role,
    prefs,
    organizer: user.organizer
      ? {
          id: user.organizer.id,
          name: user.organizer.name,
          slug: user.organizer.slug,
          verified: user.organizer.verified,
          status: user.organizer.status,
          payoutVerified: user.organizer.payoutVerified,
        }
      : null,
  };
});

export function homeFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "ORGANIZER" ? "/organizer" : "/";
}

/** For server components/layouts: redirect to sign-in or home when access is missing. */
export async function requirePage(roles?: Role[], next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** For API route handlers: throw 401/403 with JSON bodies. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}

export async function requireOrganizer(): Promise<CurrentUser & { organizer: NonNullable<CurrentUser["organizer"]> }> {
  const user = await requireUser(["ORGANIZER"]);
  if (!user.organizer) throw forbidden("Your account has no organizer profile.");
  if (user.organizer.status === "SUSPENDED") throw new ApiError(403, "This organizer account is suspended.", "SUSPENDED");
  return user as CurrentUser & { organizer: NonNullable<CurrentUser["organizer"]> };
}
