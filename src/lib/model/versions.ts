import type { PgVersion } from './types';

/** End-of-life dates published by the PostgreSQL project. */
export const VERSION_EOL: Record<PgVersion, string> = {
  19: '2031-11-19',
  18: '2030-11-14',
  17: '2029-11-08',
  16: '2028-11-09',
  15: '2027-11-11',
  14: '2026-11-12',
  13: '2025-11-13',
  12: '2024-11-21',
  11: '2023-11-09',
  10: '2022-11-10',
};

export type VersionStatus = 'current' | 'supported' | 'eol-soon' | 'eol';

const DAY_MS = 86_400_000;

export function daysUntilEndOfLife(version: PgVersion, today: Date = new Date()): number {
  const end = Date.parse(`${VERSION_EOL[version]}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((end - start) / DAY_MS);
}

export function versionStatus(version: PgVersion, today: Date = new Date()): VersionStatus {
  const days = daysUntilEndOfLife(version, today);
  if (days < 0) {
    return 'eol';
  }
  if (version === 19) {
    return 'current';
  }
  if (days <= 90) {
    return 'eol-soon';
  }
  return 'supported';
}
