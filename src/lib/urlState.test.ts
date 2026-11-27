import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORM_VALUES,
  EXAMPLES,
  formValuesFromParams,
  formValuesToInput,
  formValuesToParams,
  suggestedConnectionsFor,
  validateForm,
  type FormValues,
} from './urlState';

const VALID: FormValues = {
  version: '16',
  os: 'windows',
  workload: 'dw',
  ram: '32',
  ramUnit: 'GB',
  cpus: '8',
  connections: '200',
  storage: 'nvme',
  dbSize: 'larger',
};

describe('URL state', () => {
  it('reads valid parameters', () => {
    expect(formValuesFromParams(formValuesToParams(VALID))).toEqual(VALID);
  });

  it('falls back to defaults for unknown or invalid values', () => {
    const params = new URLSearchParams(
      'version=99&os=beos&workload=nope&ram=abc&ramUnit=PB&cpus=-1&connections=1x&storage=tape&dbSize=huge',
    );
    expect(formValuesFromParams(params)).toEqual(DEFAULT_FORM_VALUES);
  });

  it('normalises a version with leading zeros', () => {
    expect(formValuesFromParams(new URLSearchParams('version=018')).version).toBe('18');
  });

  it('omits empty optional values from the query', () => {
    const params = formValuesToParams({ ...DEFAULT_FORM_VALUES, ram: '64' });
    expect(params.has('cpus')).toBe(false);
    expect(params.has('connections')).toBe(false);
    expect(params.get('ram')).toBe('64');
    expect(params.get('ramUnit')).toBe('GB');
  });

  it('accepts an empty memory field before the first entry', () => {
    expect(validateForm(DEFAULT_FORM_VALUES)).toEqual({
      ram: 'Enter the total memory, for example 64.',
    });
  });
});

describe('form validation', () => {
  it('accepts a complete valid form', () => {
    expect(validateForm(VALID)).toEqual({});
  });

  it('rejects zero or non-numeric memory', () => {
    expect(validateForm({ ...VALID, ram: '0' }).ram).toBeDefined();
    expect(validateForm({ ...VALID, ram: '64GB' }).ram).toBeDefined();
    expect(validateForm({ ...VALID, ram: '', ramUnit: 'MB' }).ram).toBeDefined();
  });

  it('rejects memory below 64MB', () => {
    expect(validateForm({ ...VALID, ram: '32', ramUnit: 'MB' }).ram).toBe('Use at least 64MB.');
  });

  it('rejects an out-of-range CPU count', () => {
    expect(validateForm({ ...VALID, cpus: '0' }).cpus).toBeDefined();
    expect(validateForm({ ...VALID, cpus: '1025' }).cpus).toBeDefined();
  });

  it("rejects connections below PostgreSQL's practical minimum", () => {
    expect(validateForm({ ...VALID, connections: '19' }).connections).toBeDefined();
    expect(validateForm({ ...VALID, connections: '20' }).connections).toBeUndefined();
  });
});

describe('form to model', () => {
  it('converts gigabytes to megabytes', () => {
    const input = formValuesToInput(VALID);
    expect(input?.ramMb).toBe(32 * 1024);
    expect(input?.version).toBe(16);
    expect(input?.workload).toBe('dw');
  });

  it('converts megabytes and terabytes', () => {
    expect(formValuesToInput({ ...VALID, ram: '512', ramUnit: 'MB' })?.ramMb).toBe(512);
    expect(formValuesToInput({ ...VALID, ram: '1', ramUnit: 'TB' })?.ramMb).toBe(1_048_576);
  });

  it('returns null for invalid input', () => {
    expect(formValuesToInput({ ...VALID, ram: '' })).toBeNull();
  });

  it('computes a connection suggestion for the placeholder', () => {
    expect(suggestedConnectionsFor({ ...DEFAULT_FORM_VALUES, ram: '8' })).toBeGreaterThan(0);
    expect(suggestedConnectionsFor(DEFAULT_FORM_VALUES)).toBe(0);
  });

  it('keeps every example valid', () => {
    for (const example of EXAMPLES) {
      expect(formValuesToInput(example.values), example.label).not.toBeNull();
    }
  });
});
