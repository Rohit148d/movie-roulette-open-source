import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { resetRateLimiters } from "@/lib/security/rate-limit";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/health", {
    headers: { "cf-connecting-ip": "203.0.113.20", ...headers },
  });
}

beforeEach(() => {
  resetRateLimiters();
  vi.stubEnv("TMDB_DEMO_MODE", "");
  vi.stubEnv("TMDB_READ_ACCESS_TOKEN", "");
  vi.stubEnv("TMDB_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("reports ok with an unconfigured TMDB state when no token exists", async () => {
    const response = await GET(request());
    const body = (await response.json()) as { status: string; tmdb: string };
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.tmdb).toBe("unconfigured");
  });

  it("reports live without echoing the token", async () => {
    vi.stubEnv("TMDB_READ_ACCESS_TOKEN", "super-secret-token");
    const response = await GET(request());
    const text = await response.text();
    expect(text).not.toContain("super-secret-token");
    const body = JSON.parse(text) as { tmdb: string };
    expect(body.tmdb).toBe("live");
  });

  it("reports demo mode explicitly", async () => {
    vi.stubEnv("TMDB_DEMO_MODE", "true");
    const response = await GET(request());
    const body = (await response.json()) as { tmdb: string };
    expect(body.tmdb).toBe("demo");
  });

  it("rate limits health checks", async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await GET(request());
      expect(response.status).toBe(200);
    }
    const blocked = await GET(request());
    expect(blocked.status).toBe(429);
  });
});
