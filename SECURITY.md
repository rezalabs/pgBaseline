# Security policy

## Supported versions

Security fixes are made on the latest release of pgBaseline. The site is static and has no server component; the tuning model and the build toolchain are the areas where a report matters.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:

<https://github.com/rezalabs/pgBaseline/security/advisories/new>

Do not open a public issue for a vulnerability. Private reporting is enabled in the repository's Security settings; if the form is unavailable, contact the maintainer through <https://github.com/rezalabs> without including vulnerability details.

Include:

- the affected release or commit,
- the input that reproduces the problem,
- the expected and observed behavior,
- the browser, Node.js, and PostgreSQL version, where they apply.

## Scope

- The static site and the configuration it generates.
- The tuning model in `src/lib/model/`.
- The build and deployment scripts in `scripts/` and `.github/workflows/`.

Reports about a PostgreSQL release itself belong to the [PostgreSQL project](https://www.postgresql.org/support/security/).
