import { suggestConnections } from './model/compute';
import { DB_SIZES, MEMORY_UNITS, OS_TYPES, STORAGE_TYPES, WORKLOADS } from './model/types';
import type {
  DbSize,
  MemoryUnit,
  OsType,
  PgVersion,
  StorageType,
  TuningInput,
  Workload,
} from './model/types';
import { DEFAULT_VERSION, PG_VERSIONS } from './model/types';

export interface FormValues {
  version: string;
  os: OsType;
  workload: Workload;
  ram: string;
  ramUnit: MemoryUnit;
  cpus: string;
  connections: string;
  storage: StorageType;
  dbSize: DbSize;
}

export type FormErrors = Partial<Record<'ram' | 'cpus' | 'connections', string>>;

const MB_PER_GB = 1024;
const MB_PER_TB = 1024 * 1024;

export const DEFAULT_FORM_VALUES: FormValues = {
  version: String(DEFAULT_VERSION),
  os: 'linux',
  workload: 'web',
  ram: '',
  ramUnit: 'GB',
  cpus: '',
  connections: '',
  storage: 'ssd',
  dbSize: 'mid',
};

const PARAM_NAMES: (keyof FormValues)[] = [
  'version',
  'os',
  'workload',
  'ram',
  'ramUnit',
  'cpus',
  'connections',
  'storage',
  'dbSize',
];

const isVersion = (value: string): value is `${PgVersion}` =>
  (PG_VERSIONS as readonly number[]).includes(Number(value));

const isOs = (value: string): value is OsType => (OS_TYPES as readonly string[]).includes(value);
const isWorkload = (value: string): value is Workload =>
  (WORKLOADS as readonly string[]).includes(value);
const isStorage = (value: string): value is StorageType =>
  (STORAGE_TYPES as readonly string[]).includes(value);
const isDbSize = (value: string): value is DbSize =>
  (DB_SIZES as readonly string[]).includes(value);
const isUnit = (value: string): value is MemoryUnit =>
  (MEMORY_UNITS as readonly string[]).includes(value);

/** Form values from the URL. Invalid or missing values fall back to defaults. */
export function formValuesFromParams(params: URLSearchParams): FormValues {
  const next = { ...DEFAULT_FORM_VALUES };
  for (const key of PARAM_NAMES) {
    const value = params.get(key);
    if (value === null) {
      continue;
    }
    switch (key) {
      case 'version':
        if (isVersion(value)) next.version = String(Number(value));
        break;
      case 'os':
        if (isOs(value)) next.os = value;
        break;
      case 'workload':
        if (isWorkload(value)) next.workload = value;
        break;
      case 'ram':
        if (/^\d+$/.test(value)) next.ram = value;
        break;
      case 'ramUnit':
        if (isUnit(value)) next.ramUnit = value;
        break;
      case 'cpus':
        if (/^\d+$/.test(value)) next.cpus = value;
        break;
      case 'connections':
        if (/^\d+$/.test(value)) next.connections = value;
        break;
      case 'storage':
        if (isStorage(value)) next.storage = value;
        break;
      case 'dbSize':
        if (isDbSize(value)) next.dbSize = value;
        break;
    }
  }
  return next;
}

export function formValuesToParams(values: FormValues): URLSearchParams {
  const params = new URLSearchParams();
  params.set('version', values.version);
  params.set('os', values.os);
  params.set('workload', values.workload);
  params.set('ramUnit', values.ramUnit);
  params.set('storage', values.storage);
  params.set('dbSize', values.dbSize);
  if (values.ram !== '') {
    params.set('ram', values.ram);
  }
  if (values.cpus !== '') {
    params.set('cpus', values.cpus);
  }
  if (values.connections !== '') {
    params.set('connections', values.connections);
  }
  return params;
}

export function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const ram = Number(values.ram);
  if (values.ram === '' || !/^\d+$/.test(values.ram)) {
    errors.ram = 'Enter the total memory, for example 64.';
  } else if (values.ramUnit === 'MB' && ram < 64) {
    errors.ram = 'Use at least 64MB.';
  } else if (ram < 1) {
    errors.ram = 'Use a value of at least 1.';
  } else if (ram > 1_000_000) {
    errors.ram = 'Use 1,000,000 or less.';
  }

  if (values.cpus !== '') {
    const cpus = Number(values.cpus);
    if (!/^\d+$/.test(values.cpus)) {
      errors.cpus = 'Use a whole number.';
    } else if (cpus < 1 || cpus > 1024) {
      errors.cpus = 'Use between 1 and 1024.';
    }
  }

  if (values.connections !== '') {
    const connections = Number(values.connections);
    if (!/^\d+$/.test(values.connections)) {
      errors.connections = 'Use a whole number.';
    } else if (connections < 20 || connections > 260_000) {
      errors.connections = 'Use between 20 and 260,000.';
    }
  }

  return errors;
}

export function formValuesToInput(values: FormValues): TuningInput | null {
  const errors = validateForm(values);
  if (Object.keys(errors).length > 0) {
    return null;
  }
  const version = PG_VERSIONS.find((candidate) => String(candidate) === values.version);
  if (version === undefined) {
    return null;
  }
  return {
    version,
    os: values.os,
    workload: values.workload,
    ramMb:
      Number(values.ram) *
      (values.ramUnit === 'MB' ? 1 : values.ramUnit === 'GB' ? MB_PER_GB : MB_PER_TB),
    cpus: values.cpus === '' ? null : Number(values.cpus),
    connections: values.connections === '' ? null : Number(values.connections),
    storage: values.storage,
    dbSize: values.dbSize,
  };
}

export function suggestedConnectionsFor(values: FormValues): number {
  const input = formValuesToInput(values);
  if (input === null) {
    return 0;
  }
  return suggestConnections(input);
}

export interface ExamplePreset {
  label: string;
  description: string;
  values: FormValues;
}

export const EXAMPLES: readonly ExamplePreset[] = [
  {
    label: 'Small web server',
    description: '4 vCPU, 8GB RAM, SSD',
    values: {
      ...DEFAULT_FORM_VALUES,
      ram: '8',
      cpus: '4',
      workload: 'web',
      storage: 'ssd',
    },
  },
  {
    label: 'Analytics box',
    description: '32 vCPU, 128GB RAM, NVMe',
    values: {
      ...DEFAULT_FORM_VALUES,
      ram: '128',
      cpus: '32',
      workload: 'dw',
      storage: 'nvme',
      dbSize: 'larger',
    },
  },
  {
    label: 'Developer laptop',
    description: '8 vCPU, 16GB RAM, NVMe',
    values: {
      ...DEFAULT_FORM_VALUES,
      ram: '16',
      cpus: '8',
      workload: 'desktop',
      storage: 'nvme',
      dbSize: 'fits',
    },
  },
];
