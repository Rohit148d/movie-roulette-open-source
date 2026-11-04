# Third-party notices and redistribution boundaries

This repository's MIT license covers only code and material the contributors
are entitled to license. It **does not** grant rights to third-party assets.

## The Movie Database (TMDB)

Movie Roulette uses the TMDB API for movie metadata and images. TMDB is a
third-party service; the application is not endorsed or certified by TMDB.
Data and imagery fetched from TMDB are subject to TMDB's own conditions.

- API terms: https://www.themoviedb.org/api-terms-of-use
- Logos and attribution: https://www.themoviedb.org/about/logos-attribution
- Developers must obtain their **own** TMDB credentials.
- TMDB's approved logo is referenced from its official asset URL, not
  relicensed here or bundled as original project artwork.
- Don't use TMDB API data for a commercial application unless you have an
  appropriate license or agreement.

## Fonts

DM Sans and Playfair Display are distributed under the SIL Open Font License.
The original font license texts are in `public/fonts/OFL-DMSans.txt` and
`public/fonts/OFL-PlayfairDisplay.txt`. Follow their respective font licenses
when redistributing binaries or modifying the fonts.

## Dependencies

Packages declared in `package.json` have their own licenses and notices.
Use your package manager's license-report tooling before redistributing
dependency source or bundled distributions.

## Android app and screenshots

The Android app uses the Android SDK/Gradle ecosystem; its toolchain has
separate terms. Android keystores, local signing configuration, and build
artifacts must not be included in a public source release.

Screenshots may depict film posters or other images owned by third parties.
Exclude such screenshots from the public source export unless rights have
been individually established. A link to a live demo is preferable.

## Project assets

Maintain a provenance record for original illustrations and SVG icons.
Do not assume that every media file or embedded third-party mark becomes
relicensable just because this source repository contains it.
