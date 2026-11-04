import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "movie-roulette",
    entrypoint: "./src/worker-entry.ts",
    compatibilityDate: "2026-10-18",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      // Server-side TMDB configuration. Locally these come from .dev.vars;
      // in production set them as Cloudflare secrets (never client-side):
      //   npx wrangler secret put TMDB_READ_ACCESS_TOKEN --name movie-roulette
      TMDB_READ_ACCESS_TOKEN: bindings.secret(),
      TMDB_API_KEY: bindings.secret(),
      TMDB_DEMO_MODE: bindings.secret(),
    },
  }),
});
