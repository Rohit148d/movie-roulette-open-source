import { describe, expect, it } from "vitest";
import { clientIp, SlidingWindowLimiter } from "@/lib/security/rate-limit";

describe("SlidingWindowLimiter", () => {
  it("allows requests up to the limit and then blocks", () => {
    const limiter = new SlidingWindowLimiter(3, 1_000);
    expect(limiter.consume("ip", 0).allowed).toBe(true);
    expect(limiter.consume("ip", 100).allowed).toBe(true);
    expect(limiter.consume("ip", 200).allowed).toBe(true);
    const blocked = limiter.consume("ip", 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it("frees capacity once the window slides", () => {
    const limiter = new SlidingWindowLimiter(1, 1_000);
    expect(limiter.consume("ip", 0).allowed).toBe(true);
    expect(limiter.consume("ip", 500).allowed).toBe(false);
    expect(limiter.consume("ip", 1_001).allowed).toBe(true);
  });

  it("isolates keys", () => {
    const limiter = new SlidingWindowLimiter(1, 5_000);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare's trusted connecting IP", () => {
    const request = new Request("http://localhost", {
      headers: {
        "cf-connecting-ip": "203.0.113.8",
        "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      },
    });
    expect(clientIp(request)).toBe("203.0.113.8");
  });

  it("falls back to the first forwarded address", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "198.51.100.1, 198.51.100.2" },
    });
    expect(clientIp(request)).toBe("198.51.100.1");
  });
});
