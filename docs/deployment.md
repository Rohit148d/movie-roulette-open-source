# Deploying Movie Roulette web app

1. Install dependencies with `npm ci`.
2. Create a TMDB v4 read-access token in your own TMDB account.
3. Edit `wrangler.jsonc` to set a unique Worker name under your account.
4. Authenticate to Cloudflare locally with `npx wrangler login`.
5. Set the secret: `npx wrangler secret put TMDB_READ_ACCESS_TOKEN --name YOUR_WORKER_NAME`.
6. Run `npm run deploy:cloudflare`, then verify `/api/health`.

Do not use the original maintainer's deployment, credentials or Cloudflare account.
Use Worker secrets; keep `.env.local`, `.dev.vars`, tokens and signing keys private.
Consider Cloudflare WAF rate limits on publicly deployed instances.
Follow TMDB's branding and API terms; the MIT license covers only project code.
