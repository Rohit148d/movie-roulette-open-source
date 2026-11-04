import { jsonResponse, requestId } from "@/lib/http";
import { clientIp, healthLimiter } from "@/lib/security/rate-limit";
import { readTmdbConfig } from "@/lib/tmdb/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const id = requestId();
  const limit = healthLimiter.consume(clientIp(request));
  if (!limit.allowed) {
    return jsonResponse(
      { error: { code: "RATE_LIMITED", message: "Too many requests." }, requestId: id },
      429,
      {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-Request-Id": id,
      },
    );
  }

  let tmdb: "live" | "demo" | "unconfigured" | "misconfigured" = "unconfigured";
  try {
    tmdb = readTmdbConfig().mode;
  } catch {
    tmdb = "misconfigured";
  }

  return jsonResponse(
    {
      status: "ok",
      service: "movie-roulette",
      tmdb,
      time: new Date().toISOString(),
      requestId: id,
    },
    200,
    {
      "X-Request-Id": id,
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(limit.resetAt / 1000)),
    },
  );
}
