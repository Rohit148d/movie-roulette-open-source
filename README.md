# Movie Roulette â€” Open Source

An accessible movie-discovery app built using TypeScript, React, Next.js, Cloudflare
Workers, and the TMDB API. Set a mood and filters, then spin a cinematic roulette!

**This is a clean public-source release.** It excludes the maintainers' private
Git history, production settings, Android signing keys and APKs, and documentation
screenshots that may contain third-party movie imagery.

## Features
- Genre, year, rating, language, and runtime filters with server-side validation
- Server-side TMDB API integration; secrets never sent to browser clients
- Randomised recommendations with bounded retries, caching and rate limiting
- Browser-local watchlist and saved filters, without a required user account
- Keyboard navigation, reduced-motion support, accessible status messages
- Clearly labelled synthetic demo mode and automated tests

## Quick start
Requires Node.js 24.22+ (or 22.23+) and npm.

```bash
git clone https://github.com/Rohit148d/movie-roulette-open-source.git
cd movie-roulette-open-source
npm ci
cp .env.example .env.local
# Enter your own TMDB v4 read access token into .env.local
npm run dev
```

Open http://localhost:3000. Create a TMDB API token at
https://www.themoviedb.org/settings/api.
Without a token, the UI shows a configuration message.
For synthetic local UI testing, set `TMDB_DEMO_MODE=true` in `.env.local`.

## Verification
```bash
npm run typecheck
npm run lint
npm run test
npm run build
# all four:
npm run verify
```

## Cloudflare deployment
Deploy in **your own** Cloudflare account. Change Worker name in
`wrangler.jsonc`, and set your own TMDB token as a Worker secret.

```bash
npx wrangler secret put TMDB_READ_ACCESS_TOKEN --name YOUR_WORKER_NAME
npm run deploy:cloudflare
```

See [deployment details](docs/deployment.md) before deploying.

## Source layout
- `src/app`: site and API endpoints
- `src/components`: movie discovery UI
- `src/lib/tmdb`: API client and demo mode
- `src/lib/security`: throttling
- `src/worker-entry.ts`: Cloudflare Worker wrapper
- `tests/e2e`: Playwright browser checks

## TMDB attribution and restrictions
This product uses the TMDB API but is not endorsed or certified by TMDB.
Movie data and images are supplied by TMDB. The UI uses an official TMDB logo.

**TMDB's noncommercial API terms are separate from this repository's MIT
source license.** Commercial or ad-supported use of TMDB API data may
require a separate agreement. Developers supply their own credentials.
See https://www.themoviedb.org/api-terms-of-use and
https://www.themoviedb.org/about/logos-attribution.

## License and contributing
Original project source is available under the [MIT license](LICENSE).
Other assets, fonts and services have separate terms; see
[third-party notices](THIRD_PARTY_NOTICES.md).
See [contributing](CONTRIBUTING.md), [security policy](SECURITY.md), and the [release security audit](docs/SECURITY_AUDIT.md).
We welcome genuine feedback, fixes, tests and accessibility improvements.
