import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "That") => new ApiError(404, `${what} could not be found.`, "NOT_FOUND");
export const forbidden = (msg = "You don't have access to that.") => new ApiError(403, msg, "FORBIDDEN");
export const unauthorized = (msg = "Please sign in to continue.") => new ApiError(401, msg, "UNAUTHORIZED");

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: JSON-only mutations (blocks cross-site form posts),
 * uniform error shape `{ error, code, fields }`, and no stack traces leaking.
 */
export function route<P = Record<string, string>>(
  handler: (req: NextRequest, ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const type = req.headers.get("content-type") ?? "";
        if (!type.includes("application/json")) {
          throw new ApiError(415, "Requests must be sent as JSON.", "UNSUPPORTED_MEDIA_TYPE");
        }
      }
      const result = await handler(req, ctx);
      if (result instanceof NextResponse || result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message, code: err.code, fields: err.fields },
          { status: err.status },
        );
      }
      if (err instanceof ZodError) {
        const fields = zodFields(err);
        return NextResponse.json(
          { error: "Please check the highlighted fields.", code: "VALIDATION", fields },
          { status: 422 },
        );
      }
      console.error("[api] unhandled error", err);
      return NextResponse.json(
        { error: "Something went wrong on our side. Please try again.", code: "INTERNAL" },
        { status: 500 },
      );
    }
  };
}

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "That request couldn't be read.", "BAD_JSON");
  }
  return schema.parse(raw);
}
