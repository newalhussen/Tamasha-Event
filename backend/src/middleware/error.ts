import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/errors";

/** Mutations must be JSON. A cross-site HTML form can't send that content type, which blocks CSRF posts. */
export function jsonOnly(req: Request, _res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!(req.headers["content-type"] ?? "").includes("application/json")) {
      throw new ApiError(415, "Requests must be sent as JSON.", "UNSUPPORTED_MEDIA_TYPE");
    }
  }
  next();
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "That endpoint does not exist.", code: "NOT_FOUND" });
}

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Uniform error shape: `{ error, code, fields }`. Unexpected errors never leak details. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code, fields: err.fields });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: "Please check the highlighted fields.", code: "VALIDATION", fields: zodFields(err) });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "That request couldn't be read.", code: "BAD_JSON" });
    return;
  }
  console.error("[api] unhandled error", err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again.", code: "INTERNAL" });
}
