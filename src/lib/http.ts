import { AppError, isAppError } from "@/lib/tmdb/errors";

export const API_BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function requestId(): string {
  return globalThis.crypto.randomUUID();
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...API_BASE_HEADERS, ...headers },
  });
}

export function appErrorResponse(error: AppError, id: string): Response {
  const headers: Record<string, string> = { "X-Request-Id": id };
  if (typeof error.retryAfterSeconds === "number") {
    headers["Retry-After"] = String(Math.max(1, Math.ceil(error.retryAfterSeconds)));
  }
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.publicMessage,
        ...(error.retryAfterSeconds !== undefined && {
          retryAfterSeconds: error.retryAfterSeconds,
        }),
        ...(error.details ? { details: error.details } : {}),
      },
      requestId: id,
    },
    error.status,
    headers,
  );
}

export function unexpectedErrorResponse(error: unknown, id: string): Response {
  console.error(
    `[api] unexpected error requestId=${id} type=${error instanceof Error ? error.name : "unknown"}`,
  );
  return appErrorResponse(
    new AppError("TMDB_UNAVAILABLE", 500, "Something went wrong on our end. Please try again."),
    id,
  );
}

export function handleApiError(error: unknown, id: string): Response {
  if (isAppError(error)) return appErrorResponse(error, id);
  return unexpectedErrorResponse(error, id);
}
