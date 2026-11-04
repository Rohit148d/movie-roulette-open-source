export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

/**
 * Sliding-window limiter. On Cloudflare Workers this is per isolate, so it is
 * a best-effort abuse control rather than a global quota. Cloudflare's WAF and
 * rate-limiting rules should be layered on top for hard production limits.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  readonly max: number;
  readonly windowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  consume(key: string, now = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs;
    const current = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (current.length >= this.max) {
      const oldest = current[0];
      const resetAt = oldest + this.windowMs;
      this.hits.set(key, current);
      return {
        allowed: false,
        limit: this.max,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        resetAt,
      };
    }

    current.push(now);
    this.hits.set(key, current);
    this.prune(now);
    return {
      allowed: true,
      limit: this.max,
      remaining: Math.max(0, this.max - current.length),
      retryAfterSeconds: 0,
      resetAt: current[0] + this.windowMs,
    };
  }

  private prune(now: number): void {
    if (this.hits.size < 2_000) return;
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
        this.hits.delete(key);
      }
    }
  }

  reset(): void {
    this.hits.clear();
  }
}

/** 20 spins per minute per client, with a 90/min isolate-wide safety valve. */
export const spinIpLimiter = new SlidingWindowLimiter(20, 60_000);
export const spinGlobalLimiter = new SlidingWindowLimiter(90, 60_000);
export const healthLimiter = new SlidingWindowLimiter(60, 60_000);

export function clientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function resetRateLimiters(): void {
  spinIpLimiter.reset();
  spinGlobalLimiter.reset();
  healthLimiter.reset();
}
