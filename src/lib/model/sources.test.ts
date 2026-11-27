import { describe, expect, it } from 'vitest';
import { settingDocUrl } from './sources';

const DOCS = 'https://www.postgresql.org/docs';

describe('settingDocUrl', () => {
  it('pins the link to the selected major version', () => {
    expect(settingDocUrl('shared_buffers', 16)).toBe(
      `${DOCS}/16/runtime-config-resource.html#GUC-SHARED-BUFFERS`,
    );
  });

  it('links autovacuum_work_mem to the resource page in every release', () => {
    for (const version of [10, 17, 18, 19] as const) {
      expect(settingDocUrl('autovacuum_work_mem', version)).toBe(
        `${DOCS}/${version}/runtime-config-resource.html#GUC-AUTOVACUUM-WORK-MEM`,
      );
    }
  });

  it('moves the autovacuum page into the vacuum page from release 18', () => {
    expect(settingDocUrl('autovacuum_max_workers', 17)).toBe(
      `${DOCS}/17/runtime-config-autovacuum.html#GUC-AUTOVACUUM-MAX-WORKERS`,
    );
    expect(settingDocUrl('autovacuum_max_workers', 18)).toBe(
      `${DOCS}/18/runtime-config-vacuum.html#GUC-AUTOVACUUM-MAX-WORKERS`,
    );
    expect(settingDocUrl('autovacuum_vacuum_cost_limit', 19)).toBe(
      `${DOCS}/19/runtime-config-vacuum.html#GUC-AUTOVACUUM-VACUUM-COST-LIMIT`,
    );
  });

  it('uses the historical anchor for parallel maintenance workers before release 14', () => {
    expect(settingDocUrl('max_parallel_maintenance_workers', 13)).toBe(
      `${DOCS}/13/runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS-MAINTENANCE`,
    );
    expect(settingDocUrl('max_parallel_maintenance_workers', 14)).toBe(
      `${DOCS}/14/runtime-config-resource.html#GUC-MAX-PARALLEL-MAINTENANCE-WORKERS`,
    );
  });
});
