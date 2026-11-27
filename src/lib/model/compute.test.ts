import { describe, expect, it } from 'vitest';
import { computeConfiguration, suggestConnections } from './compute';
import type { SettingKey, TuningInput, TuningResult } from './types';

const TODAY = new Date('2026-11-01T00:00:00Z');

const BASE: TuningInput = {
  version: 18,
  os: 'linux',
  workload: 'oltp',
  ramMb: 65_536,
  cpus: 16,
  connections: 500,
  storage: 'nvme',
  dbSize: 'mid',
};

function compute(overrides: Partial<TuningInput> = {}, today = TODAY): TuningResult {
  return computeConfiguration({ ...BASE, ...overrides }, { today });
}

function value(result: TuningResult, key: SettingKey): number | string | undefined {
  return result.settings.find((setting) => setting.key === key)?.value;
}

function has(result: TuningResult, key: SettingKey): boolean {
  return result.settings.some((setting) => setting.key === key);
}

describe('memory ratios', () => {
  it('uses 25% of RAM for shared_buffers on a dedicated server', () => {
    expect(value(compute({ ramMb: 65_536 }), 'shared_buffers')).toBe(16_384);
    expect(value(compute({ ramMb: 2_048 }), 'shared_buffers')).toBe(512);
  });

  it('uses 15% below 1GB', () => {
    expect(value(compute({ ramMb: 512, connections: 40 }), 'shared_buffers')).toBe(76);
  });

  it('uses 1/16 of RAM on a desktop', () => {
    expect(
      value(compute({ workload: 'desktop', ramMb: 131_072, connections: 20 }), 'shared_buffers'),
    ).toBe(8_192);
  });

  it('sets effective_cache_size to 75% of RAM, or 50% on a desktop', () => {
    expect(value(compute({ ramMb: 65_536 }), 'effective_cache_size')).toBe(49_152);
    expect(
      value(
        compute({ workload: 'desktop', ramMb: 131_072, connections: 20 }),
        'effective_cache_size',
      ),
    ).toBe(65_536);
  });

  it('caps maintenance_work_mem at 2GB for general workloads', () => {
    expect(value(compute({ ramMb: 65_536 }), 'maintenance_work_mem')).toBe(2_048);
    expect(value(compute({ ramMb: 8_192 }), 'maintenance_work_mem')).toBe(512);
  });

  it('allows a 4GB maintenance budget for analytics on PostgreSQL 18+', () => {
    expect(
      value(compute({ workload: 'dw', ramMb: 131_072, cpus: 32 }), 'maintenance_work_mem'),
    ).toBe(4_096);
  });
});

describe('connections and work_mem', () => {
  it('keeps a provided connection count', () => {
    const result = compute({ connections: 500 });
    expect(result.connections).toBe(500);
    expect(result.connectionsAssumed).toBe(false);
    expect(value(result, 'max_connections')).toBe(500);
  });

  it('assumes the workload default when connections are empty', () => {
    const result = compute({ connections: null, workload: 'web', ramMb: 65_536 });
    expect(result.connections).toBe(200);
    expect(result.connectionsAssumed).toBe(true);
  });

  it('reduces assumed connections when the 4MB work_mem floor would not fit', () => {
    const result = compute({ connections: null, workload: 'web', ramMb: 2_048 });
    expect(result.connections).toBe(128);
    expect(value(result, 'work_mem')).toBe(4);
    expect(suggestConnections({ ...BASE, connections: null, workload: 'web', ramMb: 2_048 })).toBe(
      128,
    );
  });

  it('divides shared_buffers by connections and caps work_mem at 64MB', () => {
    expect(value(compute({ connections: 500 }), 'work_mem')).toBe(32);
    expect(value(compute({ connections: 100 }), 'work_mem')).toBe(64);
  });

  it('doubles work_mem for analytics and caps it at 256MB', () => {
    expect(
      value(compute({ workload: 'dw', ramMb: 32_768, cpus: 8, connections: 100 }), 'work_mem'),
    ).toBe(163);
    expect(
      value(compute({ workload: 'dw', ramMb: 131_072, cpus: 32, connections: 100 }), 'work_mem'),
    ).toBe(256);
  });

  it('halves work_mem on a desktop and keeps the 4MB floor', () => {
    const result = compute({
      workload: 'desktop',
      ramMb: 2_048,
      cpus: 4,
      connections: 20,
    });
    expect(value(result, 'work_mem')).toBe(4);
  });
});

describe('memory ledger', () => {
  it('accounts for sustained work_mem, maintenance, and the OS', () => {
    const result = compute();
    const budget = result.budget;
    expect(budget.sharedBuffersMb).toBe(16_384);
    expect(budget.workMemMb).toBe(32);
    expect(budget.workMemConcurrency).toBe(125);
    expect(budget.workMemCommittedMb).toBe(12_000);
    expect(budget.maintenanceMb).toBe(2_048);
    expect(budget.autovacuumMb).toBe(4_096);
    expect(budget.maintenanceReserveMb).toBe(6_144);
    expect(budget.osMb).toBe(31_008);
    expect(budget.osShare).toBeCloseTo(0.4731, 3);
    expect(budget.worstCaseMb).toBe(70_528);
    expect(budget.worstCaseExceedsRam).toBe(true);
    expect(budget.verdict).toBe('tight');
  });

  it('reports a healthy budget when the worst case fits', () => {
    const result = compute({ connections: 100 });
    expect(result.budget.verdict).toBe('ok');
    expect(result.budget.osShare).toBeGreaterThan(0.5);
  });

  it('reports over budget when maintenance leaves too little for the OS', () => {
    const result = compute({
      ramMb: 256,
      workload: 'web',
      cpus: 4,
      connections: 20,
    });
    expect(result.budget.verdict).toBe('over');
  });

  it('warns when all connections could exhaust memory', () => {
    const result = compute();
    const warning = result.warnings.find((item) => item.level === 'memory');
    expect(warning?.text).toContain('work_mem alone could reach');
    expect(warning?.text).toContain('transaction pooler');
  });
});

describe('version features', () => {
  it('sets checkpoint_completion_target only before PostgreSQL 14', () => {
    expect(value(compute({ version: 13 }), 'checkpoint_completion_target')).toBe(0.9);
    expect(has(compute({ version: 14 }), 'checkpoint_completion_target')).toBe(false);
  });

  it('does not add max_parallel_maintenance_workers before PostgreSQL 11', () => {
    expect(has(compute({ version: 10 }), 'max_parallel_maintenance_workers')).toBe(false);
    expect(has(compute({ version: 11 }), 'max_parallel_maintenance_workers')).toBe(true);
  });

  it('keeps parallel query settings when the CPU count is missing', () => {
    const result = compute({ cpus: null });
    expect(has(result, 'max_worker_processes')).toBe(false);
    expect(has(result, 'max_parallel_workers')).toBe(false);
    expect(result.warnings.some((warning) => warning.text.includes('CPU count is empty'))).toBe(
      true,
    );
  });

  it('disables JIT for short-query workloads before PostgreSQL 19', () => {
    expect(value(compute({ version: 18, workload: 'web' }), 'jit')).toBe('off');
    expect(value(compute({ version: 12, workload: 'oltp' }), 'jit')).toBe('off');
    expect(has(compute({ version: 19 }), 'jit')).toBe(false);
    expect(has(compute({ version: 18, workload: 'dw' }), 'jit')).toBe(false);
  });

  it('selects the WAL compression method available to the release', () => {
    expect(value(compute({ version: 15 }), 'wal_compression')).toBe('lz4');
    expect(value(compute({ version: 19 }), 'wal_compression')).toBe('on');
    expect(has(compute({ version: 14 }), 'wal_compression')).toBe(false);
  });

  it('adds io_uring only on Linux from PostgreSQL 18', () => {
    expect(value(compute({ version: 18, os: 'linux' }), 'io_method')).toBe('io_uring');
    expect(has(compute({ version: 18, os: 'windows' }), 'io_method')).toBe(false);
    expect(has(compute({ version: 17, os: 'linux' }), 'io_method')).toBe(false);
  });

  it('omits effective_io_concurrency on non-Linux before PostgreSQL 18', () => {
    expect(has(compute({ version: 17, os: 'macos' }), 'effective_io_concurrency')).toBe(false);
    expect(has(compute({ version: 18, os: 'macos' }), 'effective_io_concurrency')).toBe(true);
  });

  it('adds parallel autovacuum workers only on PostgreSQL 19 with enough CPUs', () => {
    expect(value(compute({ version: 19, cpus: 16 }), 'autovacuum_max_parallel_workers')).toBe(4);
    expect(has(compute({ version: 18, cpus: 16 }), 'autovacuum_max_parallel_workers')).toBe(false);
    expect(has(compute({ version: 19, cpus: 4 }), 'autovacuum_max_parallel_workers')).toBe(false);
  });
});

describe('platform limits and warnings', () => {
  it('holds maintenance_work_mem below 2GB on Windows before PostgreSQL 18', () => {
    expect(
      value(compute({ os: 'windows', version: 17, ramMb: 65_536 }), 'maintenance_work_mem'),
    ).toBe(2_047);
    expect(
      value(compute({ os: 'windows', version: 18, ramMb: 65_536 }), 'maintenance_work_mem'),
    ).toBe(2_048);
  });

  it('warns that the Windows cap applied', () => {
    const result = compute({ os: 'windows', version: 17, ramMb: 65_536 });
    expect(result.warnings.some((warning) => warning.text.includes('2047MB'))).toBe(true);
  });

  it('warns about LZ4 and io_uring build support', () => {
    const result = compute({ version: 18, os: 'linux' });
    expect(result.warnings.some((warning) => warning.text.includes('LZ4'))).toBe(true);
    expect(result.warnings.some((warning) => warning.text.includes('io_uring'))).toBe(true);
  });

  it('warns on an end-of-life release', () => {
    const result = compute({ version: 13, ramMb: 8_192, cpus: 4, connections: 100 });
    expect(result.warnings.some((warning) => warning.text.includes('reached end of life'))).toBe(
      true,
    );
  });

  it('warns when PostgreSQL 14 is close to end of life', () => {
    const result = compute({ version: 14, ramMb: 8_192, cpus: 4, connections: 100 });
    expect(result.warnings.some((warning) => warning.text.includes('reaches end of life'))).toBe(
      true,
    );
  });

  it('does not warn about end of life for a supported release', () => {
    const result = compute({ version: 16, ramMb: 8_192, cpus: 4, connections: 100 });
    expect(result.warnings.some((warning) => warning.text.includes('end of life'))).toBe(false);
  });
});

describe('determinism', () => {
  it('returns the same result for the same input and date', () => {
    const first = compute();
    const second = compute();
    expect(second).toEqual(first);
  });

  it('does not mutate the input object', () => {
    const input: TuningInput = { ...BASE };
    computeConfiguration(input, { today: TODAY });
    expect(input).toEqual(BASE);
  });
});
