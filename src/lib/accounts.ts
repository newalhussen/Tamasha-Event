import "server-only";
import { db } from "./db";
import { ApiError } from "./api";
import { hashPassword } from "./auth";
import { slugify } from "./format";
import type { Role } from "./enums";

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
  const user = await db.user.create({
    data: { name: input.name, email: input.email, phone: input.phone, passwordHash, role },
  });
  if (role === "ORGANIZER") {
    const name = input.organizerName?.trim() || `${input.name}'s events`;
    let slug = slugify(name);
    for (let i = 2; await db.organizer.findUnique({ where: { slug } }); i++) slug = `${slugify(name)}-${i}`;
    await db.organizer.create({ data: { userId: user.id, name, slug, status: "PENDING", verified: false } });
  }
  return user;
}
