/** Error with an HTTP status. Thrown by services, rendered as `{ error, code, fields }` by the error middleware. */
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
