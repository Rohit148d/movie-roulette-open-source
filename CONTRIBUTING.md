# Contributing to Movie Roulette

Thank you for improving Movie Roulette! Contributions should make the project
more reliable, accessible, privacy-respecting, or useful.

1. Open an issue describing the bug or feature first for major changes.
2. Fork the repository and create a feature branch.
3. Keep commits focused; do not include real credentials or user data.
4. Run `npm ci`, `npm run typecheck`, `npm run lint` and `npm run test`.
5. Open a pull request describing behavior changes, testing, and screenshots
   using **synthetic/demo content** only.
6. Confirm third-party assets and code can legally be redistributed.

Please do not submit TMDB tokens, Cloudflare account credentials, Android
signing keys, copyrighted film imagery, private student/user data, or personal
information. Use `.env.example` and `TMDB_DEMO_MODE=true` for local testing.

## Project scope

Movie Roulette is an independently maintained open-source movie discovery
application. It is not an official TMDB client. The maintainers may decline
changes that undermine API terms, security protections, attribution, or
accessibility.

## Responsible disclosure

Please see `SECURITY.md`. Do not publicly disclose an exploitable security
issue before maintainers can investigate.
