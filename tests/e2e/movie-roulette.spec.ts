import { expect, test, type Page } from "@playwright/test";

interface MoviePayload {
  movie: {
    id: number;
    title: string;
    releaseYear: number;
    runtime: number;
    voteAverage: number;
    voteCount: number;
    language: string;
    genres: { id: number }[];
  };
  source: string;
  pool: { totalResults: number };
}

function collectPageErrors(page: Page): { errors: string[]; failedRequests: string[] } {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}`);
  });
  return { errors, failedRequests };
}

test.describe("Movie Roulette production journey", () => {
  test("renders, filters, spins without repeats, and persists state", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "desktop flow; mobile layout is covered separately",
    );
    const { errors, failedRequests } = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /stop scrolling/i })).toBeVisible();
    await expect(page.getByText(/demo mode/i).first()).toBeVisible();

    // Posters and hero reel render.
    await expect(page.locator(".reel-art")).toBeVisible();
    await expect(page.getByRole("button", { name: "Action", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Apply a genre filter and spin.
    await page.getByRole("button", { name: "Action", exact: true }).click();
    await page.getByRole("button", { name: /spin the reel/i }).first().click();

    const result = page.locator("[data-movie-id]").first();
    await expect(result).toBeVisible();
    await expect(result.locator("img.poster-image")).toBeVisible();
    await expect
      .poll(async () =>
        result.locator("img.poster-image").evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);

    const firstId = await result.getAttribute("data-movie-id");
    const genres = (await result.getAttribute("data-genres"))?.split(",") ?? [];
    expect(genres).toContain("28");
    expect(Number(await result.getAttribute("data-year"))).toBeGreaterThanOrEqual(1970);
    const runtime = Number(await result.getAttribute("data-runtime"));
    expect(runtime).toBeGreaterThanOrEqual(80);
    expect(runtime).toBeLessThanOrEqual(180);
    expect(Number(await result.getAttribute("data-rating"))).toBeGreaterThanOrEqual(6.5);
    expect(Number(await result.getAttribute("data-votes"))).toBeGreaterThanOrEqual(250);

    // A second spin must not repeat the first movie and must still satisfy filters.
    await page.getByRole("button", { name: /spin again/i }).click();
    await expect
      .poll(async () => result.getAttribute("data-movie-id"))
      .not.toBe(firstId);
    const secondGenres = (await result.getAttribute("data-genres"))?.split(",") ?? [];
    expect(secondGenres).toContain("28");
    expect(Number(await result.getAttribute("data-rating"))).toBeGreaterThanOrEqual(6.5);

    // Save to the watchlist.
    const savedTitle = ((await result.locator("h2").textContent()) ?? "").trim();
    await page.getByRole("button", { name: /save to watchlist/i }).click();
    await expect(page.getByRole("button", { name: /open watchlist, 1 saved/i })).toBeVisible();

    // Reload: filters, session and watchlist survive.
    const secondId = await result.getAttribute("data-movie-id");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Action", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: /open watchlist, 1 saved/i })).toBeVisible();
    await expect(page.locator("[data-movie-id]")).toHaveAttribute("data-movie-id", secondId ?? "");

    // The watchlist drawer is a real dialog with the saved movie.
    await page.getByRole("button", { name: /open watchlist/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(savedTitle.length).toBeGreaterThan(0);
    await expect(dialog.getByText(savedTitle).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.screenshot({ path: "docs/verification/desktop-result.png", fullPage: false });

    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
    expect(failedRequests, `failed requests: ${failedRequests.join("\n")}`).toEqual([]);
  });

  test("keyboard shortcut S spins the reel", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/demo mode/i).first()).toBeVisible();
    await page.locator("h1").click();
    await page.keyboard.press("s");
    await expect(page.locator("[data-movie-id]").first()).toBeVisible();
  });

  test("serves security headers and TMDB attribution", async ({ page, request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(/This product uses the TMDB API but is not endorsed or certified by TMDB/i),
    ).toBeVisible();
  });

  test("API honours every filter and reports exhausted pools", async ({ request }) => {
    const response = await request.get(
      "/api/movies/random?genres=878,53&language=ja&yearFrom=2015&yearTo=2025&minRating=7&minVotes=1000&runtimeMin=120&runtimeMax=140",
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as MoviePayload;
    expect(body.source).toBe("demo");
    expect(body.movie.title).toBe("Neon Harvest");
    expect(body.movie.releaseYear).toBeGreaterThanOrEqual(2015);
    expect(body.movie.releaseYear).toBeLessThanOrEqual(2025);
    expect(body.movie.runtime).toBeGreaterThanOrEqual(120);
    expect(body.movie.runtime).toBeLessThanOrEqual(140);
    expect(body.movie.voteAverage).toBeGreaterThanOrEqual(7);
    expect(body.movie.voteCount).toBeGreaterThanOrEqual(1000);
    expect(body.movie.language).toBe("ja");
    expect(body.movie.genres.map((genre) => genre.id).sort()).toEqual([53, 878]);

    const excluded = await request.get("/api/movies/random?exclude=900002&language=ja");
    expect(excluded.status()).toBe(200);
    const excludedBody = (await excluded.json()) as MoviePayload;
    expect(excludedBody.movie.id).not.toBe(900002);

    const empty = await request.get("/api/movies/random?genres=28&language=ja");
    expect(empty.status()).toBe(404);
    const emptyBody = (await empty.json()) as { error: { code: string; details: { reason: string } } };
    expect(emptyBody.error.code).toBe("POOL_EXHAUSTED");
    expect(emptyBody.error.details.reason).toBe("demo_pool_exhausted");

    const invalid = await request.get("/api/movies/random?minRating=42");
    expect(invalid.status()).toBe(400);
    const invalidBody = (await invalid.json()) as { error: { code: string } };
    expect(invalidBody.error.code).toBe("INVALID_FILTERS");
  });

  test("keeps the mobile layout intact and opens the filter sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile viewport only");
    const { errors, failedRequests } = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/demo mode/i).first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: /^filters$/i }).click();
    const sidebar = page.locator(".filters-sidebar.is-open");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "Action", exact: true })).toBeVisible();
    await sidebar.getByRole("button", { name: "Action", exact: true }).click();
    await sidebar.getByRole("button", { name: /spin with these filters/i }).click();
    await expect(page.locator("[data-movie-id]").first()).toBeVisible();

    const overflowAfter = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflowAfter).toBeLessThanOrEqual(0);

    await page.screenshot({ path: "docs/verification/mobile-result.png", fullPage: false });
    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
    expect(failedRequests, `failed requests: ${failedRequests.join("\n")}`).toEqual([]);
  });
});
