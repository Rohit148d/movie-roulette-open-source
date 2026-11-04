# Security and release audit (2026-11-04)

This public-source export was prepared from a private Movie Roulette repository using
an explicit file allowlist, then tested in a fresh working directory.

## Source and history

- Reviewed 12 original commits and 147 unique historical blobs with a local
  regular-expression scan for common API tokens, access keys, private keys,
  password assignments, and suspicious credential filenames.
- No matches were detected by that scan. Pattern scanning cannot rule out
  every type of secret or vulnerability.
- Public release uses a fresh initial Git commit rather than importing the
  private history.
- Excluded Android keystores, APKs, original release artifacts, third-party
  movie-poster screenshots, and private deployment-account references.
- The public code still requires every operator to supply their own TMDB API
  credentials and cloud settings.

## Automated verification

- TypeScript: passed
- ESLint: passed with one warning for externally hosted official TMDB logo
- Vitest: 101 tests passed
- Next.js production build: passed
- Playwright desktop/mobile browser suite: 8 passed, 4 intentionally skipped

## Dependency audit

A fresh npm audit found 23 advisories (7 high, 16 moderate). An unforced
compatible `npm audit fix --package-lock-only` reduced these to
**13 moderate, 0 high, 0 critical**. Remaining issues are transitive
dependencies of framework and lint tooling; the proposed automated fixes
require major downgrades of vinext or eslint-config-next. Those changes
were deliberately not applied without compatibility testing.

This statement is a snapshot of the audit on the date above, not an ongoing
promise that dependencies have no vulnerabilities. Please monitor Dependabot
alerts and periodically rerun `npm audit`. Never run `npm audit fix --force`
blindly in production software.

## Third-party licensing

TMDB API terms and trademark rights are distinct from the MIT license for
this repository's own code. Fonts are under SIL OFL and retain license texts.
The attribution footer displays an official TMDB logo hosted by TMDB.
See `THIRD_PARTY_NOTICES.md`.

## Production

No production deployment was changed or tested as part of the public-source
release process. This audit does not assess the live host's runtime security.
