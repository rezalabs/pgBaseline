import { describe, expect, it } from 'vitest';
import { buildConfiguration, formatSettingValue, groupWarnings } from './configText';
import { computeConfiguration } from './compute';
import { settingDocUrl } from './sources';
import type { TuningInput } from './types';

const TODAY = new Date('2026-11-01T00:00:00Z');

const INPUT: TuningInput = {
  version: 18,
  os: 'linux',
  workload: 'oltp',
  ramMb: 65_536,
  cpus: 16,
  connections: 500,
  storage: 'nvme',
  dbSize: 'mid',
};

const result = computeConfiguration(INPUT, { today: TODAY });

describe('postgresql.conf output', () => {
  const build = buildConfiguration(result, { format: 'conf', includeWarnings: true });

  it('starts with the header comment', () => {
    expect(build.displayText.split('\n')[0]).toBe('# pgBaseline starting configuration');
  });

  it('includes the memory and connection settings', () => {
    expect(build.displayText).toContain('max_connections = 500');
    expect(build.displayText).toContain('shared_buffers = 16GB');
    expect(build.displayText).toContain('work_mem = 32MB');
    expect(build.displayText).toContain('effective_cache_size = 48GB');
  });

  it('marks restart-only settings and disk usage', () => {
    expect(build.displayText).toContain('# restart required');
    expect(build.displayText).toContain('max_wal_size = 16GB');
    expect(build.displayText).toContain('# needs free disk space');
  });

  it('aligns notes after the widest setting line', () => {
    const line = build.lines.find(
      (candidate) =>
        candidate[0]?.text === 'max_connections' && candidate.some((s) => s.token === 'note'),
    );
    expect(line).toBeDefined();
    const note = line?.find((segment) => segment.token === 'note');
    expect(note?.text).toBe('# restart required');
    const text = line?.map((segment) => segment.text).join('') ?? '';
    expect(text).toMatch(/^max_connections = 500 + # restart required$/);
  });

  it('puts warnings in the copy text when requested', () => {
    expect(build.copyText.startsWith('# WARNING (may prevent startup)')).toBe(true);
    expect(build.copyText).toContain('SELECT enumvals FROM pg_settings');
    expect(build.copyText).toContain('# pgBaseline starting configuration');
  });

  it('leaves warnings out of the display text', () => {
    expect(build.displayText).not.toContain('WARNING');
    expect(build.displayText).not.toContain('SELECT enumvals');
  });
});

describe('ALTER SYSTEM output', () => {
  const build = buildConfiguration(result, { format: 'alter', includeWarnings: false });

  it('quotes values and uses SQL comments', () => {
    expect(build.displayText.split('\n')[0]).toBe('-- pgBaseline starting configuration');
    expect(build.displayText).toContain("ALTER SYSTEM SET max_connections = '500';");
    expect(build.displayText).toContain("ALTER SYSTEM SET shared_buffers = '16GB';");
    expect(build.displayText).toContain('-- restart required');
  });

  it('omits warnings when the option is off', () => {
    expect(build.copyText).not.toContain('WARNING');
  });
});

describe('output invariants', () => {
  it('keeps the setting order stable', () => {
    expect(result.settings.map((setting) => setting.key)).toEqual([
      'max_connections',
      'shared_buffers',
      'effective_cache_size',
      'maintenance_work_mem',
      'random_page_cost',
      'effective_io_concurrency',
      'maintenance_io_concurrency',
      'work_mem',
      'jit',
      'wal_compression',
      'autovacuum_max_workers',
      'autovacuum_work_mem',
      'autovacuum_vacuum_cost_limit',
      'io_method',
      'min_wal_size',
      'max_wal_size',
      'max_worker_processes',
      'max_parallel_workers_per_gather',
      'max_parallel_workers',
      'max_parallel_maintenance_workers',
    ]);
  });

  it('gives every setting a rationale and at least one source', () => {
    for (const setting of result.settings) {
      expect(setting.rationale.length).toBeGreaterThan(20);
      expect(setting.sources.length).toBeGreaterThan(0);
    }
  });

  it('links each setting to version-specific documentation', () => {
    for (const setting of result.settings) {
      const url = settingDocUrl(setting.key, 18);
      expect(url).toContain('/docs/18/runtime-config-');
      expect(url).toContain(`#GUC-${setting.key.toUpperCase().replaceAll('_', '-')}`);
    }
  });

  it('formats memory settings in whole units and leaves other values plain', () => {
    const shared = result.settings.find((setting) => setting.key === 'shared_buffers');
    const connects = result.settings.find((setting) => setting.key === 'max_connections');
    expect(shared && formatSettingValue(shared)).toBe('16GB');
    expect(connects && formatSettingValue(connects)).toBe('500');
  });

  it('groups warnings in startup, memory, note order', () => {
    const groups = groupWarnings([
      { level: 'note', text: 'note' },
      { level: 'memory', text: 'memory' },
      { level: 'startup', text: 'startup' },
    ]);
    expect(groups.map((group) => group.level)).toEqual(['startup', 'memory', 'note']);
  });
});
