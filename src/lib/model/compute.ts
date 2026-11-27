import { formatDate, formatMemory, formatNumber, formatPercent, dayWord } from './format';
import { STORAGE_LABELS, WORKLOAD_LABELS } from './labels';
import type {
  MemoryBudget,
  PgVersion,
  SettingKey,
  SourceId,
  TuningInput,
  TuningResult,
  TuningSetting,
  WarningItem,
} from './types';
import { VERSION_EOL, daysUntilEndOfLife, versionStatus } from './versions';

const MB_PER_GB = 1024;
const NODE_FACTOR = 3;
const SUSTAINED_FRACTION = 0.25;
const WORK_MEM_FLOOR_MB = 4;
const MIN_CONNECTIONS = 20;
const MAX_CONNECTIONS = 260_000;
const MAX_PARALLEL_WORKERS = 32;
const DEFAULT_CONNECTIONS: Record<TuningInput['workload'], number> = {
  web: 200,
  oltp: 300,
  dw: 100,
  desktop: 20,
  mixed: 100,
};
const WORK_MEM_CAP_MB: Record<TuningInput['workload'], number> = {
  web: 64,
  oltp: 64,
  dw: 256,
  desktop: 16,
  mixed: 64,
};
const WORK_MEM_MULTIPLIER: Record<TuningInput['workload'], number> = {
  web: 1,
  oltp: 1,
  dw: 2,
  desktop: 0.5,
  mixed: 1,
};
const STORAGE_IO_CONCURRENCY: Record<TuningInput['storage'], number> = {
  hdd: 2,
  ssd: 200,
  san: 300,
  nvme: 1000,
};

interface ResolvedInput extends TuningInput {
  cpus: number | null;
  ramMb: number;
}

function resolveInput(input: TuningInput): ResolvedInput {
  return {
    ...input,
    ramMb: Math.max(64, Math.floor(input.ramMb)),
    cpus: input.cpus === null ? null : Math.min(1024, Math.max(1, Math.floor(input.cpus))),
  };
}

function sharedBuffersMb(input: ResolvedInput): number {
  if (input.workload === 'desktop') {
    return Math.max(16, Math.floor(input.ramMb / 16));
  }
  if (input.ramMb < MB_PER_GB) {
    return Math.max(16, Math.floor(input.ramMb * 0.15));
  }
  return Math.floor(input.ramMb * 0.25);
}

function effectiveConnections(
  input: ResolvedInput,
  sharedBuffers: number,
): { value: number; assumed: boolean } {
  if (input.connections !== null) {
    return {
      value: Math.min(MAX_CONNECTIONS, Math.max(MIN_CONNECTIONS, Math.floor(input.connections))),
      assumed: false,
    };
  }
  const memoryFit = Math.floor((input.ramMb - sharedBuffers) / (WORK_MEM_FLOOR_MB * NODE_FACTOR));
  return {
    value: Math.max(MIN_CONNECTIONS, Math.min(DEFAULT_CONNECTIONS[input.workload], memoryFit)),
    assumed: true,
  };
}

function workMemValue(
  input: ResolvedInput,
  sharedBuffers: number,
  connections: number,
): { value: number; adjusted: number } {
  const adjusted = (sharedBuffers / connections) * WORK_MEM_MULTIPLIER[input.workload];
  const cap = WORK_MEM_CAP_MB[input.workload];
  return {
    value: Math.min(cap, Math.max(WORK_MEM_FLOOR_MB, Math.floor(adjusted))),
    adjusted,
  };
}

function maintenanceWorkMemValue(input: ResolvedInput): {
  value: number;
  raw: number;
  cap: number;
  windowsCapped: boolean;
} {
  const raw = Math.max(64, Math.floor(input.ramMb / (input.workload === 'dw' ? 8 : 16)));
  const analyticsCap = input.version >= 18 && input.os !== 'windows' && input.workload === 'dw';
  const hardCap = analyticsCap ? 4096 : 2048;
  const windowsCap =
    input.os === 'windows' && input.version <= 17 ? 2047 : Number.POSITIVE_INFINITY;
  const cap = Math.min(hardCap, windowsCap);
  const value = Math.max(64, Math.min(raw, cap));
  return {
    value,
    raw,
    cap,
    windowsCapped: input.os === 'windows' && input.version <= 17 && raw > 2047,
  };
}

function parallelSettings(
  input: ResolvedInput,
  cpus: number | null,
): { settings: TuningSetting[]; workersPerGather: number } {
  if (cpus === null || cpus < 4) {
    return { settings: [], workersPerGather: 0 };
  }

  const workers = Math.min(cpus, MAX_PARALLEL_WORKERS);
  const workersPerGather =
    input.workload === 'dw'
      ? Math.min(8, Math.max(2, Math.floor(workers / 2)))
      : Math.min(4, Math.max(2, Math.floor(workers / 2)));
  const maintenanceWorkers = Math.min(4, Math.max(2, Math.floor(workers / 4)));

  const settings: TuningSetting[] = [
    setting({
      key: 'max_worker_processes',
      value: Math.max(8, workers),
      unit: 'plain',
      restart: true,
      rationale: `${Math.max(8, workers)} background worker slots for parallel queries, autovacuum, and extensions; the PostgreSQL default is 8.`,
      sources: ['pgResource', 'pgWikiTuning'],
    }),
    setting({
      key: 'max_parallel_workers_per_gather',
      value: workersPerGather,
      unit: 'plain',
      restart: false,
      rationale:
        input.workload === 'dw'
          ? `${workersPerGather} workers per parallel query. Analytics benefits from wider scans, but work_mem is charged to every worker.`
          : `${workersPerGather} workers per parallel query. Each worker gets its own work_mem allowance, so short-query workloads keep this modest.`,
      sources: ['pgResource', 'pgWikiTuning'],
    }),
  ];

  settings.push(
    setting({
      key: 'max_parallel_workers',
      value: workers,
      unit: 'plain',
      restart: false,
      rationale: `${workers} workers cluster-wide for parallel query, capped at ${MAX_PARALLEL_WORKERS}. Must not exceed max_worker_processes.`,
      sources: ['pgResource', 'pgWikiTuning'],
    }),
  );

  if (input.version >= 11) {
    settings.push(
      setting({
        key: 'max_parallel_maintenance_workers',
        value: maintenanceWorkers,
        unit: 'plain',
        restart: false,
        rationale: `${maintenanceWorkers} workers per maintenance command such as CREATE INDEX. Maintenance memory is shared across these workers.`,
        sources: ['pgResource', 'pgWikiTuning'],
      }),
    );
  }

  return { settings, workersPerGather };
}

function setting(params: {
  key: SettingKey;
  value: number | string;
  unit: 'memory' | 'plain';
  restart: boolean;
  rationale: string;
  sources: readonly SourceId[];
}): TuningSetting {
  return {
    key: params.key,
    value: params.value,
    unit: params.unit,
    restart: params.restart,
    rationale: params.rationale,
    sources: params.sources,
  };
}

function restartRequired(key: SettingKey, version: PgVersion): boolean {
  if (key === 'autovacuum_max_workers') {
    return version < 18;
  }
  return (
    key === 'max_connections' ||
    key === 'shared_buffers' ||
    key === 'max_worker_processes' ||
    key === 'io_method'
  );
}

function buildWarnings(params: {
  input: ResolvedInput;
  today: Date;
  sharedBuffers: number;
  connections: number;
  workMem: number;
  workMemAdjusted: number;
  maintenanceWorkMem: number;
  maintenanceWorkMemRaw: number;
  windowsCapped: boolean;
  autovacuumWorkers: number;
  autovacuumWorkMem: number | null;
  budget: MemoryBudget;
  jitDisabled: boolean;
  ioConcurrencyOmitted: boolean;
  hasCpus: boolean;
}): WarningItem[] {
  const {
    input,
    today,
    sharedBuffers,
    connections,
    workMem,
    workMemAdjusted,
    maintenanceWorkMem,
    maintenanceWorkMemRaw,
    windowsCapped,
    autovacuumWorkers,
    autovacuumWorkMem,
    budget,
    jitDisabled,
    ioConcurrencyOmitted,
    hasCpus,
  } = params;
  const warnings: WarningItem[] = [];
  const status = versionStatus(input.version, today);
  const days = daysUntilEndOfLife(input.version, today);

  if (status === 'eol') {
    warnings.push({
      level: 'note',
      text: `PostgreSQL ${input.version} reached end of life on ${formatDate(VERSION_EOL[input.version])}. It no longer receives security or bug fixes; plan an upgrade.`,
    });
  } else if (status === 'eol-soon') {
    warnings.push({
      level: 'note',
      text: `PostgreSQL ${input.version} reaches end of life on ${formatDate(VERSION_EOL[input.version])}, ${days} ${dayWord(days)} from now. Plan an upgrade.`,
    });
  }

  if (input.ramMb < MB_PER_GB) {
    warnings.push({
      level: 'note',
      text: 'Less than 1GB of RAM is below the size this model is designed for. PostgreSQL needs a smaller share of memory here, and the result should be treated as a rough starting point.',
    });
  } else if (input.ramMb > 1_048_576) {
    warnings.push({
      level: 'note',
      text: 'Above 1TB of RAM, benchmark the workload before trusting any static formula. Memory ratios are less important than per-query behaviour at that size.',
    });
  }

  const worstWorkMem = workMem * connections * NODE_FACTOR;
  if (budget.worstCaseExceedsRam) {
    warnings.push({
      level: 'memory',
      text: `Expected load fits, but if all ${formatNumber(connections)} connections ran a three-node sort or hash at once, work_mem alone could reach ${formatMemory(worstWorkMem)}. Lower work_mem for the busiest roles, lower max_connections, or put a transaction pooler in front.`,
    });
  } else if (workMemAdjusted < WORK_MEM_FLOOR_MB) {
    warnings.push({
      level: 'memory',
      text: `shared_buffers divided by max_connections is below the 4MB work_mem floor. With ${formatNumber(connections)} connections, work_mem can still commit ${formatMemory(worstWorkMem)} if every connection sorts at once.`,
    });
  }

  if (budget.osShare < 0.1) {
    warnings.push({
      level: 'memory',
      text: `Shared buffers, the sustained work_mem budget, and maintenance memory leave ${formatMemory(budget.osMb)} (${formatPercent(budget.osShare)}) for the operating system. Lower maintenance_work_mem or work_mem, or add RAM.`,
    });
  }

  if (sharedBuffers >= 2048) {
    if (input.os === 'linux') {
      warnings.push({
        level: 'note',
        text: `shared_buffers is ${formatMemory(sharedBuffers)}. Reserve matching huge pages to reduce page-table overhead. Read the required count while the server is stopped, then set vm.nr_hugepages; huge_pages = try is already the PostgreSQL default.`,
        code: 'postgres -D $PGDATA -C shared_memory_size_in_huge_pages',
      });
    } else if (input.os === 'windows') {
      warnings.push({
        level: 'note',
        text: `shared_buffers is ${formatMemory(sharedBuffers)}. Grant the PostgreSQL service account the "Lock pages in memory" right to use large pages. The setting is ignored on macOS.`,
      });
    }
  }

  if (input.version >= 15 && input.version <= 18) {
    warnings.push({
      level: 'startup',
      text: 'wal_compression = lz4 requires a PostgreSQL build with LZ4 support. Check the available values before restarting the server.',
      code: "SELECT enumvals FROM pg_settings WHERE name = 'wal_compression';",
    });
  }

  if (input.version >= 18 && input.os === 'linux') {
    warnings.push({
      level: 'startup',
      text: "io_method = io_uring requires a build with liburing support, a kernel with io_uring enabled, and container permissions that allow it. Docker's default seccomp profile blocks io_uring. Check the available values before restarting.",
      code: "SELECT enumvals FROM pg_settings WHERE name = 'io_method';",
    });
  }

  if (
    input.storage === 'hdd' &&
    (input.workload === 'web' || input.workload === 'oltp' || input.workload === 'mixed')
  ) {
    warnings.push({
      level: 'note',
      text: 'Spinning disks are the bottleneck for this workload. Storage has more effect on latency than these settings; move the data directory to SSD or NVMe if you can.',
    });
  }

  if (!hasCpus) {
    warnings.push({
      level: 'note',
      text: 'CPU count is empty, so parallel query settings and extra autovacuum workers are left at their defaults.',
    });
  }

  if (windowsCapped) {
    warnings.push({
      level: 'note',
      text: `Windows builds before PostgreSQL 18 cap maintenance_work_mem just below 2GB, so the value is held at 2047MB instead of ${formatMemory(maintenanceWorkMemRaw)}.`,
    });
  }

  if (maintenanceWorkMem > 1024 && autovacuumWorkMem !== null) {
    warnings.push({
      level: 'note',
      text: `autovacuum_work_mem is capped at 1GB per worker while ${autovacuumWorkers} autovacuum workers may run, so the maintenance reserve stays bounded.`,
    });
  }

  if (connections > 200) {
    warnings.push({
      level: 'note',
      text: `max_connections is ${formatNumber(connections)}. Each connection is a separate process; a transaction pooler is usually a better lever than raising this further.`,
    });
  }

  if (jitDisabled) {
    warnings.push({
      level: 'note',
      text: 'JIT is disabled for this workload. If the same cluster also runs long analytical queries, enable jit for those roles instead of turning it back on globally.',
    });
  }

  if (ioConcurrencyOmitted) {
    warnings.push({
      level: 'note',
      text: `effective_io_concurrency is left unchanged: PostgreSQL ${input.version} only uses it on platforms with prefetch support, which in practice means Linux.`,
    });
  }

  if (input.dbSize === 'larger') {
    warnings.push({
      level: 'note',
      text: 'The database is more than 3 times RAM. Monitor cache hit ratio and I/O latency after applying; effective_cache_size is an estimate and does not reserve memory.',
    });
  }

  return warnings;
}

/**
 * Builds a complete starting configuration from the hardware and workload
 * inputs. Pure: the same input and reference date always produce the same
 * result.
 */
export function computeConfiguration(
  rawInput: TuningInput,
  options: { today?: Date } = {},
): TuningResult {
  const input = resolveInput(rawInput);
  const today = options.today ?? new Date();
  const sharedBuffers = sharedBuffersMb(input);
  const effectiveCacheSize = Math.floor(input.ramMb * (input.workload === 'desktop' ? 0.5 : 0.75));
  const maintenance = maintenanceWorkMemValue(input);
  const connections = effectiveConnections(input, sharedBuffers);
  const workMem = workMemValue(input, sharedBuffers, connections.value);
  const parallel = parallelSettings(input, input.cpus);
  const autovacuumWorkers =
    input.cpus === null ? 3 : input.cpus >= 32 ? 6 : input.cpus >= 16 ? 4 : 3;
  const autovacuumWorkMem = maintenance.value > 1024 ? 1024 : null;
  const autovacuumCostLimit =
    autovacuumWorkers > 3 ? Math.round((200 * autovacuumWorkers) / 3) : null;

  const maintenanceReserve =
    maintenance.value + (autovacuumWorkMem ?? maintenance.value) * autovacuumWorkers;
  const workMemConcurrency = Math.max(1, Math.ceil(connections.value * SUSTAINED_FRACTION));
  const workMemCommitted = workMem.value * workMemConcurrency * NODE_FACTOR;
  const used = sharedBuffers + workMemCommitted + maintenanceReserve;
  const osMb = Math.max(0, input.ramMb - used);
  const osShare = input.ramMb > 0 ? osMb / input.ramMb : 0;
  const worstCaseMb =
    sharedBuffers + workMem.value * connections.value * NODE_FACTOR + maintenanceReserve;
  const worstCaseExceedsRam = worstCaseMb > input.ramMb;
  const verdict = osShare < 0.1 ? 'over' : osShare < 0.2 || worstCaseExceedsRam ? 'tight' : 'ok';

  const budget: MemoryBudget = {
    totalMb: input.ramMb,
    sharedBuffersMb: sharedBuffers,
    workMemMb: workMem.value,
    workMemConcurrency,
    workMemCommittedMb: workMemCommitted,
    maintenanceMb: maintenance.value,
    autovacuumMb: (autovacuumWorkMem ?? maintenance.value) * autovacuumWorkers,
    maintenanceReserveMb: maintenanceReserve,
    osMb,
    osShare,
    worstCaseMb,
    worstCaseExceedsRam,
    verdict,
  };

  const maxWalSize = Math.min(16384, Math.max(1024, sharedBuffers * 2));
  const minWalSize = Math.min(4096, Math.max(256, Math.floor(maxWalSize / 2)));
  const ioConcurrencyApplies = input.version >= 18 || input.os === 'linux';
  const ioConcurrency = STORAGE_IO_CONCURRENCY[input.storage];
  const jitDisabled =
    input.version >= 12 &&
    input.version < 19 &&
    (input.workload === 'web' || input.workload === 'oltp' || input.workload === 'mixed');
  const ioMethod = input.version >= 18 && input.os === 'linux' ? 'io_uring' : null;
  const walCompression = input.version >= 19 ? 'on' : input.version >= 15 ? 'lz4' : null;

  const connectionRationale = connections.assumed
    ? `Assumed from the ${WORKLOAD_LABELS[input.workload]} profile${connections.value < DEFAULT_CONNECTIONS[input.workload] ? ' and reduced so a 4MB work_mem floor can fit' : ''}. Each backend is a process, so this value is also a memory multiplier.`
    : `You provided ${formatNumber(connections.value)} connections. Each backend is a process, so this value is also a memory multiplier; the worst case above uses it.`;

  const sharedRationale =
    input.workload === 'desktop'
      ? `${formatMemory(sharedBuffers)} is 1/16 of RAM, leaving memory for the desktop, editor, and containers running beside PostgreSQL.`
      : input.ramMb < MB_PER_GB
        ? `${formatMemory(sharedBuffers)} is about 15% of RAM, because the operating system needs a larger share on hosts below 1GB.`
        : `${formatMemory(sharedBuffers)} is 25% of RAM, the documented starting point for a dedicated server. PostgreSQL also relies on the OS page cache, and allocations above 40% of RAM are unlikely to help.`;

  const settings: TuningSetting[] = [
    setting({
      key: 'max_connections',
      value: connections.value,
      unit: 'plain',
      restart: true,
      rationale: connectionRationale,
      sources: ['pgConnection', 'pgWikiTuning'],
    }),
    setting({
      key: 'shared_buffers',
      value: sharedBuffers,
      unit: 'memory',
      restart: true,
      rationale: sharedRationale,
      sources: ['pgResource', 'pgWikiTuning'],
    }),
    setting({
      key: 'effective_cache_size',
      value: effectiveCacheSize,
      unit: 'memory',
      restart: false,
      rationale:
        input.workload === 'desktop'
          ? `${formatMemory(effectiveCacheSize)} is 50% of RAM, a conservative planner estimate for a shared workstation. It does not reserve memory.`
          : `${formatMemory(effectiveCacheSize)} is 75% of RAM. The planner treats shared_buffers plus the OS page cache as available to a query; this is an estimate, not an allocation.`,
      sources: ['pgQuery', 'pgWikiTuning'],
    }),
    setting({
      key: 'maintenance_work_mem',
      value: maintenance.value,
      unit: 'memory',
      restart: false,
      rationale: `RAM/${input.workload === 'dw' ? '8' : '16'}, capped at ${formatMemory(maintenance.cap)}. Used by VACUUM, CREATE INDEX, and restores. Autovacuum workers are bounded separately below.`,
      sources: ['pgResource', 'pgRelease17', 'pgWindowsMemory'],
    }),
  ];

  if (input.version <= 13) {
    settings.push(
      setting({
        key: 'checkpoint_completion_target',
        value: 0.9,
        unit: 'plain',
        restart: false,
        rationale:
          '0.9 spreads checkpoint writes over 90% of the interval. PostgreSQL 14 made 0.9 the default; older versions keep 0.5 unless it is set.',
        sources: ['pgWal', 'pgRelease14'],
      }),
    );
  }

  settings.push(
    setting({
      key: 'random_page_cost',
      value: input.dbSize === 'fits' || input.storage !== 'hdd' ? 1.1 : 4,
      unit: 'plain',
      restart: false,
      rationale:
        input.dbSize === 'fits'
          ? 'The database fits in RAM, so random reads should mostly hit cache; 1.1 keeps the planner from overpricing index access.'
          : input.storage === 'hdd'
            ? '4.0 keeps the planner from preferring random index access on spinning disks, where a seek is far more expensive than a sequential read.'
            : '1.1 reflects SSD, NVMe, or network storage where random reads cost close to sequential reads. Verify the plans for analytical queries after applying.',
      sources: ['pgQuery', 'pgWikiTuning'],
    }),
  );

  if (ioConcurrencyApplies) {
    settings.push(
      setting({
        key: 'effective_io_concurrency',
        value: ioConcurrency,
        unit: 'plain',
        restart: false,
        rationale: `${ioConcurrency} concurrent I/O requests for ${STORAGE_LABELS[input.storage]} storage. PostgreSQL 18 raised the default to 16; this value matches the device instead.`,
        sources:
          input.version >= 18
            ? ['pgResource', 'pgRelease18', 'pgEicDefault']
            : ['pgResource', 'daliboPerf'],
      }),
    );
  }

  if (input.version >= 13 && ioConcurrencyApplies) {
    settings.push(
      setting({
        key: 'maintenance_io_concurrency',
        value: ioConcurrency,
        unit: 'plain',
        restart: false,
        rationale:
          'Matches the storage concurrency used for query I/O. Available since PostgreSQL 13; PostgreSQL 18 raised its default to 16.',
        sources: ['pgResource', 'pgRelease18'],
      }),
    );
  }

  settings.push(
    setting({
      key: 'work_mem',
      value: workMem.value,
      unit: 'memory',
      restart: false,
      rationale: `shared_buffers divided by max_connections${input.workload === 'dw' ? ', doubled for analytics' : input.workload === 'desktop' ? ', halved for a desktop' : ''}, capped at ${WORK_MEM_CAP_MB[input.workload]}MB. Allocated per sort or hash node, so one complex query can use several times this value.`,
      sources: ['pgResource', 'pganalyzeWorkMem'],
    }),
  );

  if (jitDisabled) {
    settings.push(
      setting({
        key: 'jit',
        value: 'off',
        unit: 'plain',
        restart: false,
        rationale:
          'Off for short-query workloads. The JIT cost model is unreliable for small queries, and compilation can dominate their runtime.',
        sources: ['pgQuery', 'pgRelease19'],
      }),
    );
  }

  if (walCompression !== null) {
    settings.push(
      setting({
        key: 'wal_compression',
        value: walCompression,
        unit: 'plain',
        restart: false,
        rationale:
          walCompression === 'on'
            ? 'on selects the best available method (Zstandard, LZ4, or pglz), reducing WAL volume at some CPU cost.'
            : 'LZ4 compresses full-page WAL images with low CPU cost. It requires a PostgreSQL build with LZ4 support.',
        sources: input.version >= 19 ? ['pgWal', 'pgRelease19'] : ['pgWal', 'pgRelease15'],
      }),
    );
  }

  if (autovacuumWorkers > 3) {
    settings.push(
      setting({
        key: 'autovacuum_max_workers',
        value: autovacuumWorkers,
        unit: 'plain',
        restart: restartRequired('autovacuum_max_workers', input.version),
        rationale: `Raised from the default 3 for ${formatNumber(input.cpus ?? 0)} CPUs so autovacuum can keep up with a larger machine.`,
        sources: ['pgVacuum', 'pgRelease18'],
      }),
    );
  }

  if (autovacuumWorkMem !== null) {
    settings.push(
      setting({
        key: 'autovacuum_work_mem',
        value: autovacuumWorkMem,
        unit: 'memory',
        restart: false,
        rationale:
          '1GB per worker. Several autovacuum workers can run at once, so leaving this at maintenance_work_mem would multiply the memory reserve.',
        sources: ['pgVacuum', 'pgResource'],
      }),
    );
  }

  if (autovacuumCostLimit !== null) {
    settings.push(
      setting({
        key: 'autovacuum_vacuum_cost_limit',
        value: autovacuumCostLimit,
        unit: 'plain',
        restart: false,
        rationale: `${autovacuumCostLimit}, scaled from the default 200 by the worker count so each worker keeps roughly the default cost budget.`,
        sources: ['pgVacuum'],
      }),
    );
  }

  const parallelAutovacuum =
    input.version >= 19 && input.cpus !== null && input.cpus >= 8
      ? Math.min(4, Math.max(2, Math.floor(input.cpus / 4)))
      : null;
  if (parallelAutovacuum !== null) {
    settings.push(
      setting({
        key: 'autovacuum_max_parallel_workers',
        value: parallelAutovacuum,
        unit: 'plain',
        restart: false,
        rationale: `${parallelAutovacuum} parallel index-vacuum workers, available in PostgreSQL 19. They come from the max_parallel_workers pool.`,
        sources: ['pgVacuum', 'pgRelease19'],
      }),
    );
  }

  if (ioMethod !== null) {
    settings.push(
      setting({
        key: 'io_method',
        value: ioMethod,
        unit: 'plain',
        restart: true,
        rationale:
          'io_uring gives the highest asynchronous I/O throughput on Linux when the build, kernel, and container allow it.',
        sources: ['pgResource', 'pgRelease18'],
      }),
    );
  }

  settings.push(
    setting({
      key: 'min_wal_size',
      value: minWalSize,
      unit: 'memory',
      restart: false,
      rationale: `${formatMemory(minWalSize)} of WAL kept for recycling, so normal write bursts do not force new segment creation.`,
      sources: ['pgWal', 'daliboPerf'],
    }),
    setting({
      key: 'max_wal_size',
      value: maxWalSize,
      unit: 'memory',
      restart: false,
      rationale: `${formatMemory(maxWalSize)}: twice shared_buffers, capped at 16GB. Larger values reduce checkpoint frequency at the cost of disk space and crash recovery time.`,
      sources: ['pgWal', 'daliboPerf'],
    }),
    ...parallel.settings,
  );

  const warnings = buildWarnings({
    input,
    today,
    sharedBuffers,
    connections: connections.value,
    workMem: workMem.value,
    workMemAdjusted: workMem.adjusted,
    maintenanceWorkMem: maintenance.value,
    maintenanceWorkMemRaw: maintenance.raw,
    windowsCapped: maintenance.windowsCapped,
    autovacuumWorkers,
    autovacuumWorkMem,
    budget,
    jitDisabled,
    ioConcurrencyOmitted: !ioConcurrencyApplies,
    hasCpus: input.cpus !== null,
  });

  return {
    input,
    settings: settings.map((item) => ({
      ...item,
      restart: restartRequired(item.key, input.version),
    })),
    warnings,
    budget,
    connections: connections.value,
    connectionsAssumed: connections.assumed,
  };
}

/** Connection count the form would assume if the field is left empty. */
export function suggestConnections(input: TuningInput): number {
  const resolved = resolveInput(input);
  return effectiveConnections(resolved, sharedBuffersMb(resolved)).value;
}
