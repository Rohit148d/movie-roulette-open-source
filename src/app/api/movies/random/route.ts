import { parseFiltersFromSearchParams } from "@/lib/filters";
import {
  API_BASE_HEADERS,
  appErrorResponse,
  handleApiError,
  jsonResponse,
  requestId,
} from "@/lib/http";
import {
  clientIp,
  spinGlobalLimiter,
  spinIpLimiter,
} from "@/lib/security/rate-limit";
import { AppError } from "@/lib/tmdb/errors";
import { findRandomMovie } from "@/lib/tmdb/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_URL_LENGTH = 4_096;

function rateHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}

export async function GET(request: Request): Promise<Response> {
  const id = requestId();
  const ip = clientIp(request);
  const ipLimit = spinIpLimiter.consume(ip);
  const globalLimit = spinGlobalLimiter.consume("global");
  const limitHeaders = rateHeaders(
    ipLimit.limit,
    ipLimit.remaining,
    ipLimit.resetAt,
  );

  if (!ipLimit.allowed || !globalLimit.allowed) {
    const retryAfter = Math.max(
      ipLimit.retryAfterSeconds,
      globalLimit.retryAfterSeconds,
      1,
    );
    return appErrorResponse(
      new AppError(
        "RATE_LIMITED",
        429,
        "You're spinning too fast. Give the reel a few seconds to cool down.",
        { retryAfterSeconds: retryAfter },
      ),
      id,
    );
  }

  if (request.url.length > MAX_URL_LENGTH) {
    return appErrorResponse(
      new AppError("INVALID_FILTERS", 400, "The request URL is too long."),
      id,
    );
  }

  let parsed: ReturnType<typeof parseFiltersFromSearchParams>;
  try {
    parsed = parseFiltersFromSearchParams(new URL(request.url).searchParams);
  } catch {
    return appErrorResponse(
      new AppError("INVALID_FILTERS", 400, "The request URL is invalid."),
      id,
    );
  }

  if (!parsed.ok) {
    return appErrorResponse(
      new AppError("INVALID_FILTERS", 400, parsed.message, {
        details: { fields: parsed.fields },
      }),
      id,
    );
  }

  try {
    const result = await findRandomMovie(parsed.filters, parsed.excludeIds, {
      signal: request.signal,
    });
    return jsonResponse(
      {
        ...result,
        requestId: id,
      },
      200,
      {
        ...limitHeaders,
        "X-Request-Id": id,
        "X-Content-Type-Options": "nosniff",
      },
    );
  } catch (error) {
    if (error instanceof AppError) {
      // Safe operational log: codes and counts only, never credentials or
      // raw upstream payloads.
      console.warn(
        `[api:movies:random] requestId=${id} code=${error.code} status=${error.status}`,
      );
    }
    const response = handleApiError(error, id);
    for (const [key, value] of Object.entries(limitHeaders)) {
      response.headers.set(key, value);
    }
    if (!response.headers.has("Content-Type")) {
      response.headers.set("Content-Type", API_BASE_HEADERS["Content-Type"]);
    }
    return response;
  }
}
