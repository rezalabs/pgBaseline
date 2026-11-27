# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-28

### Added

- A PostgreSQL starting configuration generated in the browser for versions 10 through 19, from the operating system, workload, RAM, CPU count, connection count, storage type, and database size.
- A memory ledger with the sustained `work_mem` budget, the maintenance and autovacuum reserve, the memory left for the operating system, and the all-connections worst case.
- Warnings grouped by startup risk, memory risk, and notes, including the end-of-life dates published by the PostgreSQL project.
- A rationale and documentation link for every setting, plus a Method page that lists every source behind the model.
- `postgresql.conf` and `ALTER SYSTEM` output, with warnings included as comments when copying.
- URL query parameters that reproduce a configuration, a copy-link action, and three worked examples.
- Light and dark themes, reduced-motion handling, forced-colors support, and a layout that reflows to 320 CSS pixels.
- GitHub Pages deployment with a `404.html` shell and a directory copy of each route, so deep links return 200 with their own title.
- Vitest unit and component tests, `svelte-check` type checking, an ESLint and Prettier check, an unused-code check, CI on every pull request and every push to `main`, a weekly dependency audit, and a tag-triggered GitHub release.

[Unreleased]: https://github.com/rezalabs/pgBaseline/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rezalabs/pgBaseline/releases/tag/v1.0.0
