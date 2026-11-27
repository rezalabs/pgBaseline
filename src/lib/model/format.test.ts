import { describe, expect, it } from 'vitest';
import {
  dayWord,
  formatDate,
  formatMemory,
  formatMemoryApprox,
  formatNumber,
  formatPercent,
} from './format';

describe('formatting', () => {
  it('uses exact units for configuration values', () => {
    expect(formatMemory(1024)).toBe('1GB');
    expect(formatMemory(1536)).toBe('1536MB');
    expect(formatMemory(32)).toBe('32MB');
  });

  it('rounds summary memory to one decimal place', () => {
    expect(formatMemoryApprox(10008)).toBe('9.8GB');
    expect(formatMemoryApprox(2048)).toBe('2GB');
    expect(formatMemoryApprox(512)).toBe('512MB');
  });

  it('formats counts and percentages for English', () => {
    expect(formatNumber(260_000)).toBe('260,000');
    expect(formatPercent(0.256)).toBe('26%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('formats dates without ambiguous numeric months', () => {
    expect(formatDate('2026-11-12')).toBe('12 Nov 2026');
  });

  it('pluralises day counts', () => {
    expect(dayWord(1)).toBe('day');
    expect(dayWord(11)).toBe('days');
  });
});
