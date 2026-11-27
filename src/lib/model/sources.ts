import type { PgVersion, SettingKey, Source, SourceId } from './types';

export const SOURCES: Record<SourceId, Source> = {
  pgResource: {
    title: 'PostgreSQL 19: Resource Consumption',
    url: 'https://www.postgresql.org/docs/19/runtime-config-resource.html',
    note: 'shared_buffers, work_mem, effective_io_concurrency, io_method, worker process limits',
  },
  pgQuery: {
    title: 'PostgreSQL 19: Query Planning',
    url: 'https://www.postgresql.org/docs/19/runtime-config-query.html',
    note: 'effective_cache_size, random_page_cost, JIT, statistics target',
  },
  pgWal: {
    title: 'PostgreSQL 19: Write Ahead Log',
    url: 'https://www.postgresql.org/docs/19/runtime-config-wal.html',
    note: 'WAL buffers, compression, checkpoints, WAL size limits',
  },
  pgVacuum: {
    title: 'PostgreSQL 19: Vacuuming',
    url: 'https://www.postgresql.org/docs/19/runtime-config-vacuum.html',
    note: 'autovacuum workers and cost limits',
  },
  pgConnection: {
    title: 'PostgreSQL 19: Connections and Authentication',
    url: 'https://www.postgresql.org/docs/19/runtime-config-connection.html',
    note: 'max_connections and reserved connection slots',
  },
  pgHugePages: {
    title: 'PostgreSQL 19: Managing Kernel Resources',
    url: 'https://www.postgresql.org/docs/19/kernel-resources.html',
    note: 'Linux huge pages and memory overcommit',
  },
  pgRelease19: {
    title: 'PostgreSQL 19 release notes',
    url: 'https://www.postgresql.org/docs/release/19.0/',
    note: 'JIT disabled by default, self-scaling I/O workers, parallel autovacuum',
  },
  pgRelease18: {
    title: 'PostgreSQL 18 release notes',
    url: 'https://www.postgresql.org/docs/release/18.0/',
    note: 'asynchronous I/O, effective_io_concurrency defaults, autovacuum_worker_slots',
  },
  pgRelease17: {
    title: 'PostgreSQL 17 release notes',
    url: 'https://www.postgresql.org/docs/release/17.0/',
    note: 'vacuum memory above 1GB, incremental backup',
  },
  pgRelease15: {
    title: 'PostgreSQL 15 release notes',
    url: 'https://www.postgresql.org/docs/release/15.0/',
    note: 'LZ4 and Zstandard WAL compression',
  },
  pgRelease14: {
    title: 'PostgreSQL 14 release notes',
    url: 'https://www.postgresql.org/docs/release/14.0/',
    note: 'checkpoint_completion_target and vacuum cost defaults',
  },
  pgRelease12: {
    title: 'PostgreSQL 12 release notes',
    url: 'https://www.postgresql.org/docs/release/12.0/',
    note: 'autovacuum cost delay default',
  },
  pganalyzeWorkMem: {
    title: 'pganalyze: work_mem check',
    url: 'https://pganalyze.com/docs/checks/settings/work_mem',
    note: 'shared_buffers divided by max_connections, bounded 1MB to 256MB',
  },
  pgWikiTuning: {
    title: 'PostgreSQL wiki: Tuning Your PostgreSQL Server',
    url: 'https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server',
    note: 'cache sizing and common starting points',
  },
  daliboPerf: {
    title: 'Dalibo: PostgreSQL performance training handout',
    url: 'https://public.dalibo.com/exports/formation/manuels/formations/perf1/perf1.no-tp.handout.pdf',
    note: 'storage-specific concurrency and WAL sizing examples',
  },
  pgVersioning: {
    title: 'PostgreSQL versioning policy',
    url: 'https://www.postgresql.org/support/versioning/',
    note: 'end-of-life dates by major version',
  },
  pgWindowsMemory: {
    title: 'pgsql-hackers: maintenance_work_mem limit on 64-bit Windows',
    url: 'https://www.postgresql.org/message-id/1a01f0-66ec2d80-3b-68487680@27595217',
    note: 'explains the 2GB cap before PostgreSQL 18',
  },
  pgEicDefault: {
    title: 'PostgreSQL commit: effective_io_concurrency default 16',
    url: 'https://www.postgresql.org/message-id/E1tsSFH-0029BG-38%40gemulon.postgresql.org',
    note: 'rationale for the PostgreSQL 18 default',
  },
};

type DocPage =
  | 'runtime-config-resource'
  | 'runtime-config-query'
  | 'runtime-config-wal'
  | 'runtime-config-vacuum'
  | 'runtime-config-autovacuum'
  | 'runtime-config-connection';

const DOC_PAGES: Record<SettingKey, DocPage> = {
  max_connections: 'runtime-config-connection',
  shared_buffers: 'runtime-config-resource',
  effective_cache_size: 'runtime-config-query',
  maintenance_work_mem: 'runtime-config-resource',
  checkpoint_completion_target: 'runtime-config-wal',
  random_page_cost: 'runtime-config-query',
  effective_io_concurrency: 'runtime-config-resource',
  maintenance_io_concurrency: 'runtime-config-resource',
  work_mem: 'runtime-config-resource',
  jit: 'runtime-config-query',
  wal_compression: 'runtime-config-wal',
  autovacuum_max_workers: 'runtime-config-autovacuum',
  autovacuum_work_mem: 'runtime-config-resource',
  autovacuum_vacuum_cost_limit: 'runtime-config-autovacuum',
  autovacuum_max_parallel_workers: 'runtime-config-vacuum',
  io_method: 'runtime-config-resource',
  min_wal_size: 'runtime-config-wal',
  max_wal_size: 'runtime-config-wal',
  max_worker_processes: 'runtime-config-resource',
  max_parallel_workers_per_gather: 'runtime-config-resource',
  max_parallel_workers: 'runtime-config-resource',
  max_parallel_maintenance_workers: 'runtime-config-resource',
};

/** First major version whose documentation anchors `max_parallel_maintenance_workers` by its own name. */
const MAINTENANCE_WORKERS_ANCHOR_VERSION = 14;

/**
 * PostgreSQL documentation link for a setting, pinned to the selected major
 * version. Version 18 moved the autovacuum section into the vacuum page, and
 * releases before 14 anchor `max_parallel_maintenance_workers` as
 * `GUC-MAX-PARALLEL-WORKERS-MAINTENANCE`.
 */
export function settingDocUrl(key: SettingKey, version: PgVersion): string {
  let page = DOC_PAGES[key];
  if (page === 'runtime-config-autovacuum' && version >= 18) {
    page = 'runtime-config-vacuum';
  }
  const anchor =
    key === 'max_parallel_maintenance_workers' && version < MAINTENANCE_WORKERS_ANCHOR_VERSION
      ? 'MAX-PARALLEL-WORKERS-MAINTENANCE'
      : key.toUpperCase().replaceAll('_', '-');
  return `https://www.postgresql.org/docs/${version}/${page}.html#GUC-${anchor}`;
}
