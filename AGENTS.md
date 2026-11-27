# Project notes

Static Svelte 5 + Vite + TypeScript site that generates a PostgreSQL starting configuration in the browser.

## Commands

- `npm run dev`, `npm run build`, `npm run preview`
- `npm run lint` (ESLint + Prettier check), `npm run typecheck` (svelte-check), `npm run knip` (unused files, exports, and dependencies), `npm test` (Vitest)
- `npm run build` also copies `dist/index.html` to `dist/404.html` and to `dist/<route>/index.html` for each route listed in `scripts/postbuild.mjs`. That is what makes deep links such as `/method` return 200 on GitHub Pages; a new route needs an entry there.

## Conventions and gotchas

- `BASE_PATH` sets the Vite base, with or without a trailing slash; `pages.yml` passes the base path that `actions/configure-pages` reads from the Pages configuration, and `import.meta.env.BASE_URL` feeds every route link. On Windows Git Bash, prefix a `BASE_PATH=...` command with `MSYS2_ENV_CONV_EXCL=BASE_PATH`; MSYS otherwise rewrites the leading-slash value into a Windows path.
- Any single-column CSS grid that can contain wide content needs `grid-template-columns: minmax(0, 1fr)`; otherwise its auto track grows to the content's min-content width and the page overflows at 320px.
- The tuning model is pure and lives in `src/lib/model/compute.ts`; `docs/model.md` records every rule and its source. Update both, plus `src/lib/model/compute.test.ts`, when a rule changes.
- Version-specific settings must stay behind a release check; a setting emitted for a release that lacks it blocks server startup.
- CI and the weekly security workflow run `npm audit` over the full tree and fail on any advisory.
- The Node floor is `^22.22.2 || ^24.15.0 || >=26.0.0`, the strictest range among the toolchain packages (jsdom 30 sets it; ESLint 10 and Vitest 5 allow older 22.x). `engines`, the README requirements, and the CI matrix must agree.
- After editing `package.json` fields such as `engines`, run `npm install --package-lock-only` so the lockfile's root entry agrees.
- `package.json` and `CHANGELOG.md` carry the same version, and the changelog heading is `## [X.Y.Z] - YYYY-MM-DD` with link references at the bottom. Pushing an annotated `vX.Y.Z` tag runs `release.yml`, which checks the tag, the changelog, and the manifest version, runs CI, and creates the GitHub release. The site itself deploys from `main` through `pages.yml`.
- The project is maintainer-only: the README states that outside pull requests are not accepted.
- The palette lives in `src/styles/tokens.css`; the dark theme and `prefers-contrast: more` are full redefinitions, not inversions. `public/favicon.svg`, the two `theme-color` metas in `index.html`, the README badge hexes, and `docs/screenshot.png` repeat those values and must be updated with the palette.
- The display name is `pgBaseline` (`SITE_NAME` in `src/lib/model/meta.ts`, plus the README, the favicon label, and the generated config header). `index.html` carries no copy of its own: the Vite plugin in `vite.config.ts` fills its `%SITE_TITLE%` and `%SITE_DESCRIPTION%` tokens from `meta.ts`, and `scripts/postbuild.mjs` rewrites the title, description, and both Open Graph tags for each route. Identifiers stay lowercase `pgbaseline`: the package name and the `pgbaseline-theme` storage key (renaming it resets every user's saved theme). The GitHub repository is `rezalabs/pgBaseline`, spelled like the display name; every repository URL uses that spelling, and the Pages `BASE_PATH` follows it as `/pgBaseline/`.
- `SITE_DESCRIPTION` is the single one-line description for the hero, the home page metadata, `package.json`, and the README opening, and `src/lib/model/meta.test.ts` fails when any of them drifts. `COPYRIGHT_HOLDER`, `COPYRIGHT_YEAR`, and `PUBLISHER_URL` (the rezalabs.com credit, which must stay in the footer, the README, and the package author) feed the footer notice and match `LICENSE`; the year is fixed at first publication, while the footer's build date comes from `__BUILD_DATE__`.
- Licensing: the project is MIT (`LICENSE`). Text and rule selection reused from PGTune (also MIT) are documented in `THIRD-PARTY-NOTICES.md`; when borrowing more wording, add it there in the same change. `scripts/postbuild.mjs` copies `LICENSE` and the notices into `dist/` so the built site ships them.
