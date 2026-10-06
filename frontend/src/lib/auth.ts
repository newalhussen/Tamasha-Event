import { redirect } from "next/navigation";
import { cache } from "react";
import { apiGet } from "./server-api";
import type { CurrentUser, Role } from "./types";

export type { CurrentUser } from "./types";

/** The signed-in user for this request (asked of the backend once per render), or null for visitors. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { user } = await apiGet<{ user: CurrentUser | null }>("/auth/me");
  return user;
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
