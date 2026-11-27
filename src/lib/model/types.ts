export const PG_VERSIONS = [19, 18, 17, 16, 15, 14, 13, 12, 11, 10] as const;
export type PgVersion = (typeof PG_VERSIONS)[number];
export const DEFAULT_VERSION: PgVersion = 18;

export const OS_TYPES = ['linux', 'macos', 'windows'] as const;
export type OsType = (typeof OS_TYPES)[number];

export const WORKLOADS = ['web', 'oltp', 'dw', 'desktop', 'mixed'] as const;
export type Workload = (typeof WORKLOADS)[number];

export const STORAGE_TYPES = ['nvme', 'ssd', 'san', 'hdd'] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export const DB_SIZES = ['fits', 'mid', 'larger'] as const;
export type DbSize = (typeof DB_SIZES)[number];

export const MEMORY_UNITS = ['MB', 'GB', 'TB'] as const;
export type MemoryUnit = (typeof MEMORY_UNITS)[number];

export type WarningLevel = 'startup' | 'memory' | 'note';

export type SettingKey =
  | 'max_connections'
  | 'shared_buffers'
  | 'effective_cache_size'
  | 'maintenance_work_mem'
  | 'checkpoint_completion_target'
  | 'random_page_cost'
  | 'effective_io_concurrency'
  | 'maintenance_io_concurrency'
  | 'work_mem'
  | 'jit'
  | 'wal_compression'
  | 'autovacuum_max_workers'
  | 'autovacuum_work_mem'
  | 'autovacuum_vacuum_cost_limit'
  | 'autovacuum_max_parallel_workers'
  | 'io_method'
  | 'min_wal_size'
  | 'max_wal_size'
  | 'max_worker_processes'
  | 'max_parallel_workers_per_gather'
  | 'max_parallel_workers'
  | 'max_parallel_maintenance_workers';

export interface TuningInput {
  version: PgVersion;
  os: OsType;
  workload: Workload;
  ramMb: number;
  cpus: number | null;
  connections: number | null;
  storage: StorageType;
  dbSize: DbSize;
}

export interface TuningSetting {
  key: SettingKey;
  value: number | string;
  unit: 'memory' | 'plain';
  restart: boolean;
  rationale: string;
  sources: readonly SourceId[];
}

export interface WarningItem {
  level: WarningLevel;
  text: string;
  code?: string;
}

export type BudgetVerdict = 'ok' | 'tight' | 'over';

export interface MemoryBudget {
  totalMb: number;
  sharedBuffersMb: number;
  workMemMb: number;
  workMemConcurrency: number;
  workMemCommittedMb: number;
  maintenanceMb: number;
  autovacuumMb: number;
  maintenanceReserveMb: number;
  osMb: number;
  osShare: number;
  worstCaseMb: number;
  worstCaseExceedsRam: boolean;
  verdict: BudgetVerdict;
}

export interface TuningResult {
  input: TuningInput;
  settings: TuningSetting[];
  warnings: WarningItem[];
  budget: MemoryBudget;
  connections: number;
  connectionsAssumed: boolean;
}

export type SourceId =
  | 'pgResource'
  | 'pgQuery'
  | 'pgWal'
  | 'pgVacuum'
  | 'pgConnection'
  | 'pgHugePages'
  | 'pgRelease19'
  | 'pgRelease18'
  | 'pgRelease17'
  | 'pgRelease15'
  | 'pgRelease14'
  | 'pgRelease12'
  | 'pganalyzeWorkMem'
  | 'pgWikiTuning'
  | 'daliboPerf'
  | 'pgVersioning'
  | 'pgWindowsMemory'
  | 'pgEicDefault';

export interface Source {
  title: string;
  url: string;
  note?: string;
}
