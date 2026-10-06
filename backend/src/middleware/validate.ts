import type { Request } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/errors";

/** Parse and validate a request body. Throws a ZodError that the error middleware turns into field errors. */
export function body<T>(req: Request, schema: ZodType<T>): T {
  if (req.body === undefined || req.body === null || typeof req.body !== "object") {
    throw new ApiError(400, "That request couldn't be read.", "BAD_JSON");
  }
  return schema.parse(req.body);
}
