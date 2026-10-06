import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";
import { db } from "../db/prisma";
import type { Role } from "../utils/constants";
import { ApiError } from "../utils/errors";
import { slugify } from "../utils/format";

const secret = new TextEncoder().encode(env.authSecret);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function signSession(userId: string, role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.sessionDays}d`)
    .sign(secret);
}

export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ?? null;
  } catch {
    return null;
  }
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

/** Load the signed-in user fresh from the DB, so suspensions and role changes apply immediately. */
export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { organizer: true } });
  if (!user || user.status !== "ACTIVE") return null;
  const prefs = { smsReminder: true, emailFollowed: true, weeklyPicks: false, ...((user.prefs as object) ?? {}) };
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
}

// One message for unknown email and wrong password so accounts can't be enumerated.
const BAD_CREDENTIALS = "That email and password don't match. Check them and try again.";

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) throw new ApiError(401, BAD_CREDENTIALS, "BAD_CREDENTIALS");
  if (user.status !== "ACTIVE") throw new ApiError(403, "This account is suspended. Contact support.", "SUSPENDED");
  return user;
}

export function homeFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "ORGANIZER" ? "/organizer" : "/";
}

export async function createAccount(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: Extract<Role, "ATTENDEE" | "ORGANIZER">;
  organizerName?: string;
}) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists. Sign in instead.", "EMAIL_TAKEN", {
      email: "An account with this email already exists.",
    });
  }
  const passwordHash = await hashPassword(input.password);
  const role = input.role ?? "ATTENDEE";
  const user = await db.user.create({ data: { name: input.name, email: input.email, phone: input.phone, passwordHash, role } });
  if (role === "ORGANIZER") {
    const name = input.organizerName?.trim() || `${input.name}'s events`;
    let slug = slugify(name);
    for (let i = 2; await db.organizer.findUnique({ where: { slug } }); i++) slug = `${slugify(name)}-${i}`;
    await db.organizer.create({ data: { userId: user.id, name, slug, status: "PENDING", verified: false } });
  }
  return user;
}

export async function updateProfile(
  userId: string,
  input: { name: string; phone?: string; city?: string; prefs?: { smsReminder: boolean; emailFollowed: boolean; weeklyPicks: boolean } },
) {
  await db.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone ?? null, ...(input.city ? { city: input.city } : {}), ...(input.prefs ? { prefs: input.prefs } : {}) },
  });
}
