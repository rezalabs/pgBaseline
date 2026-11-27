import type { DbSize, OsType, StorageType, Workload } from './types';

export const OS_LABELS: Record<OsType, string> = {
  linux: 'Linux',
  macos: 'macOS',
  windows: 'Windows',
};

export const WORKLOAD_LABELS: Record<Workload, string> = {
  web: 'Web application',
  oltp: 'Online transaction processing',
  dw: 'Data warehouse',
  desktop: 'Desktop or development',
  mixed: 'Mixed workload',
};

export const WORKLOAD_DESCRIPTIONS: Record<Workload, { summary: string; examples: string }> = {
  web: {
    summary: 'Many short, simple queries, mostly reads.',
    examples: 'Websites, APIs, SaaS back ends.',
  },
  oltp: {
    summary: 'Many concurrent short transactions with frequent writes.',
    examples: 'Payments, orders, bookings, inventory.',
  },
  dw: {
    summary: 'Few long analytical queries over large data sets, plus bulk loads.',
    examples: 'Reporting, analytics, business intelligence.',
  },
  desktop: {
    summary: 'PostgreSQL shares the machine with other programs and gets a small slice of RAM.',
    examples: 'Developer workstations, local or test databases.',
  },
  mixed: {
    summary: 'Short transactions and heavy analytical queries on the same cluster.',
    examples: 'An application that also runs reports against its primary.',
  },
};

export const STORAGE_LABELS: Record<StorageType, string> = {
  nvme: 'NVMe',
  ssd: 'SSD',
  san: 'SAN or network storage',
  hdd: 'HDD',
};

export const STORAGE_HINTS: Record<StorageType, string> = {
  nvme: 'Local NVMe, or a cloud volume with high IOPS',
  ssd: 'SATA or SAS SSD, or a general-purpose cloud volume',
  san: 'Network-attached storage with higher latency',
  hdd: 'Spinning disks; random I/O is the bottleneck',
};

export const DB_SIZE_LABELS: Record<DbSize, string> = {
  fits: 'Fits in RAM',
  mid: '1 to 3 times RAM',
  larger: 'More than 3 times RAM',
};

export const DB_SIZE_HINTS: Record<DbSize, string> = {
  fits: 'The working set can stay in the OS page cache.',
  mid: 'Common for OLTP systems with a working set near RAM size.',
  larger: 'Most reads hit storage; cache assumptions matter more.',
};
