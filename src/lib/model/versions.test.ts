import { describe, expect, it } from 'vitest';
import { daysUntilEndOfLife, VERSION_EOL, versionStatus } from './versions';

const NOV_1_2026 = new Date('2026-11-01T00:00:00Z');
const NOV_13_2026 = new Date('2026-11-13T00:00:00Z');

describe('PostgreSQL end-of-life status', () => {
  it('marks end-of-life releases', () => {
    expect(versionStatus(13, NOV_1_2026)).toBe('eol');
    expect(versionStatus(10, NOV_1_2026)).toBe('eol');
  });

  it('marks PostgreSQL 14 as end of life soon', () => {
    expect(versionStatus(14, NOV_1_2026)).toBe('eol-soon');
    expect(versionStatus(14, NOV_13_2026)).toBe('eol');
  });

  it('keeps supported releases supported', () => {
    expect(versionStatus(15, NOV_1_2026)).toBe('supported');
    expect(versionStatus(18, NOV_1_2026)).toBe('supported');
  });

  it('labels the newest release as current', () => {
    expect(versionStatus(19, NOV_1_2026)).toBe('current');
  });

  it('counts the days to the published end-of-life date', () => {
    expect(daysUntilEndOfLife(15, NOV_1_2026)).toBe(375);
    expect(daysUntilEndOfLife(14, NOV_1_2026)).toBe(11);
  });

  it('publishes a date for every supported major version', () => {
    for (const date of Object.values(VERSION_EOL)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
