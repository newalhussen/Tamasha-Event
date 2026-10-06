import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * Server-side GET against the backend API, forwarding the visitor's session cookie.
 * 404 renders the not-found page, 401 sends the visitor to sign in, 403 sends them home.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const jar = await cookies();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api${path}`, { headers: { cookie: jar.toString() }, cache: "no-store" });
  } catch {
    throw new Error("The Tamasha API is not reachable. Is the backend running?");
  }
  if (res.status === 404) notFound();
  if (res.status === 401) redirect("/login");
  if (res.status === 403) redirect("/");
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

/** Like apiGet, but returns null instead of rendering not-found. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const res = await fetch(`${BACKEND_URL}/api${path}`, { headers: { cookie: jar.toString() }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}
