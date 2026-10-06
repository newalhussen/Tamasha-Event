"use client";

export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Typed fetch wrapper for the JSON API. Throws ClientError with field messages. */
export async function api<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ClientError("We couldn't reach the server. Check your connection and try again.", 0, "NETWORK");
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ClientError(data?.error ?? "Something went wrong. Please try again.", res.status, data?.code, data?.fields ?? {});
  }
  return data as T;
}
