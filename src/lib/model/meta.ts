export const SITE_NAME = 'pgBaseline';
export const RESEARCH_DATE = '2026-11-22';
export const SITE_TITLE = `${SITE_NAME}: PostgreSQL starting configuration`;
/** The one-line description used by the hero, the metadata, the README, and the package. */
export const SITE_DESCRIPTION =
  'A starting configuration for your PostgreSQL server, from your version, operating system, workload, and hardware, with the documentation behind every value.';

/** Rights holder named in `LICENSE`, the README, and the footer. */
export const COPYRIGHT_HOLDER = 'RezaLabs';
/** Year of first publication. Fixed, so the notice does not change every January. */
export const COPYRIGHT_YEAR = '2026';

/** Publisher site credited in the footer, the README, and the package author. */
export const PUBLISHER_URL = 'https://rezalabs.com';
export const REPO_URL = 'https://github.com/rezalabs/pgBaseline';
export const LICENSE_NAME = 'MIT';
export const SUPPORT_URL = 'https://ko-fi.com/rezalabs';
export const INSPIRATION_URL = 'https://github.com/le0pard/pgtune';

/** URL of a file copied into the build by `scripts/postbuild.mjs`. */
export function staticFile(name: string): string {
  return `${import.meta.env.BASE_URL}${name}`;
}

/**
 * Build date injected by Vite. Falls back to the model review date when the
 * value is absent, so tests and static analysis never see an undefined date.
 */
export function lastUpdated(): string {
  const injected = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';
  return injected.slice(0, 10) || RESEARCH_DATE;
}
