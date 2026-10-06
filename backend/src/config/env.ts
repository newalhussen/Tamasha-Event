const isProd = process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const authSecret = process.env.AUTH_SECRET ?? "";
if (isProd && authSecret.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters in production.");

/** Validated runtime configuration. Everything else reads config from here, never from process.env. */
export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  authSecret: authSecret || "dev-only-insecure-secret-do-not-use",
  /** Origin(s) of the Next.js frontend allowed to call the API with cookies. Comma-separated. */
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  sessionCookie: "tamasha_session",
  sessionDays: 7,
};
