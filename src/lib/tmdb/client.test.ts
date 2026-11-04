import { beforeEach, describe, expect, it, vi } from "vitest";
import { TmdbClient } from "@/lib/tmdb/client";
import { clearTmdbCache } from "@/lib/tmdb/cache";
import type { TmdbConfig } from "@/lib/tmdb/config";

const liveConfig: TmdbConfig = {
  mode: "live",
  token: "secret-read-token",
  baseUrl: "https://api.themoviedb.org/3",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  clearTmdbCache();
});

describe("TmdbClient", () => {
  it("sends the bearer token server-side and returns JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    const client = new TmdbClient({ config: liveConfig, fetchImpl: fetchImpl as typeof fetch });
    const result = await client.get<{ ok: boolean }>("/discover/movie", { page: 2 });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/discover/movie?page=2");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-read-token",
    );
    expect(url).not.toContain("secret-read-token");
  });

  it("uses the legacy api_key query parameter when no bearer token exists", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    const client = new TmdbClient({
      config: { ...liveConfig, token: undefined, apiKey: "legacy-key" },
      fetchImpl: fetchImpl as typeof fetch,
    });
    await client.get("/genre/movie/list");

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("api_key=legacy-key");
  });

  it("caches successful responses for the requested TTL", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => json({ value: 1 }));
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => 1_000,
    });

    await client.get("/movie/1", {}, { ttlMs: 5_000 });
    await client.get("/movie/1", {}, { ttlMs: 5_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await client.get("/movie/1", {}, { ttlMs: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries transient 5xx responses and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "upstream" }, 503))
      .mockResolvedValueOnce(json({ ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      sleep,
    });

    await expect(client.get("/movie/1", {}, { retries: 1 })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
  });

  it("returns a friendly rate-limit error after exhausting retries", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json({}, 429, { "retry-after": "0" }));
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await expect(client.get("/movie/1", {}, { retries: 1 })).rejects.toMatchObject({
      code: "TMDB_RATE_LIMITED",
      status: 429,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry invalid credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 401));
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await expect(client.get("/movie/1", {}, { retries: 3 })).rejects.toMatchObject({
      code: "TMDB_INVALID_CREDENTIALS",
      status: 502,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("times out hung requests with a bounded friendly error", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      client.get("/movie/1", {}, { retries: 0, timeoutMs: 30, deadlineMs: 500 }),
    ).rejects.toMatchObject({ code: "TMDB_TIMEOUT", status: 504 });
  });

  it("retries network failures and then reports TMDB unavailable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await expect(client.get("/movie/1", {}, { retries: 1 })).rejects.toMatchObject({
      code: "TMDB_UNAVAILABLE",
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses to call TMDB when not configured", async () => {
    const fetchImpl = vi.fn();
    const client = new TmdbClient({
      config: { mode: "unconfigured", baseUrl: "https://api.themoviedb.org/3" },
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.get("/movie/1")).rejects.toMatchObject({
      code: "TMDB_NOT_CONFIGURED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never includes credentials in error messages", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 401));
    const client = new TmdbClient({
      config: liveConfig,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    try {
      await client.get("/movie/1", {}, { retries: 0 });
      throw new Error("expected rejection");
    } catch (error) {
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain("secret-read-token");
    }
  });
});
