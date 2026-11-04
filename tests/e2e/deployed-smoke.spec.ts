import { expect, test } from "@playwright/test";

const deployedUrl = process.env.PLAYWRIGHT_DEPLOYED_URL;

test.describe("deployed Cloudflare smoke checks", () => {
  test.skip(!deployedUrl, "Set PLAYWRIGHT_DEPLOYED_URL to smoke test a deployment");

  test("serves the app, security headers and a safe unconfigured state", async ({
    page,
    request,
  }) => {
    const base = deployedUrl ?? "";

    const home = await request.get(`${base}/`);
    expect(home.status()).toBe(200);
    const headers = home.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toContain("max-age=");

    const health = await request.get(`${base}/api/health`);
    expect(health.status()).toBe(200);
    const healthBody = (await health.json()) as { status: string; tmdb: string };
    expect(healthBody.status).toBe("ok");
    expect(["unconfigured", "live", "demo"]).toContain(healthBody.tmdb);

    const spin = await request.get(`${base}/api/movies/random?minRating=7`);
    if (healthBody.tmdb === "unconfigured") {
      expect(spin.status()).toBe(503);
      const body = (await spin.json()) as { error: { code: string } };
      expect(body.error.code).toBe("TMDB_NOT_CONFIGURED");
    } else {
      expect(spin.status()).toBe(200);
    }

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /stop scrolling/i })).toBeVisible();
    await expect(
      page.getByText(/This product uses the TMDB API but is not endorsed or certified by TMDB/i),
    ).toBeVisible();
    if (healthBody.tmdb === "unconfigured") {
      await expect(page.getByText("Connect the projector.")).toBeVisible();
      await expect(page.getByRole("button", { name: /spin the reel/i }).first()).toBeDisabled();
    }
  });
});
