<script lang="ts">
  import {
    formatMemory,
    formatMemoryApprox,
    formatNumber,
    formatPercent,
  } from '../lib/model/format';
  import type { MemoryBudget } from '../lib/model/types';

  let {
    budget,
    connections,
    connectionsAssumed,
  }: {
    budget: MemoryBudget;
    connections: number;
    connectionsAssumed: boolean;
  } = $props();

  interface Segment {
    key: 'sb' | 'work' | 'maint' | 'os';
    label: string;
    value: number;
    share: number;
  }

  const usedMb = $derived(budget.totalMb - budget.osMb);
  const scale = $derived(usedMb > budget.totalMb ? budget.totalMb / usedMb : 1);
  const segments = $derived([
    {
      key: 'sb',
      label: 'Shared buffers',
      value: budget.sharedBuffersMb,
      share: (budget.sharedBuffersMb / budget.totalMb) * 100 * scale,
    },
    {
      key: 'work',
      label: `work_mem at ${formatPercent(budget.workMemConcurrency / connections)} concurrency`,
      value: budget.workMemCommittedMb,
      share: (budget.workMemCommittedMb / budget.totalMb) * 100 * scale,
    },
    {
      key: 'maint',
      label: 'Maintenance and autovacuum',
      value: budget.maintenanceReserveMb,
      share: (budget.maintenanceReserveMb / budget.totalMb) * 100 * scale,
    },
    {
      key: 'os',
      label: 'Free for the OS and page cache',
      value: budget.osMb,
      share: (budget.osMb / budget.totalMb) * 100 * scale,
    },
  ] satisfies Segment[]);

  const verdictLabel = $derived(
    budget.verdict === 'ok'
      ? 'Within budget'
      : budget.verdict === 'tight'
        ? 'Tight'
        : 'Over budget',
  );

  const verdictDetail = $derived.by(() => {
    const free = `${formatMemory(budget.osMb)} (${formatPercent(budget.osShare)}) remains for the OS, page cache, and other processes.`;
    if (budget.verdict === 'over') {
      return `${free} This configuration is likely to exhaust memory under load.`;
    }
    if (budget.verdict === 'tight') {
      return budget.osShare >= 0.2
        ? `Sustained load fits, but the all-connections worst case does not. A transaction pooler or a lower work_mem closes the gap.`
        : `${free} Lower work_mem or maintenance_work_mem, or add RAM.`;
    }
    return free;
  });
</script>

<figure class="ledger">
  <figcaption class="ledger__head">
    <h3>Memory ledger</h3>
    <span class="verdict verdict--{budget.verdict}">
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {#if budget.verdict === 'ok'}
          <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.8" />
        {:else if budget.verdict === 'tight'}
          <path d="M8 2.5 14.5 13.5h-13Z" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path d="M8 6.5v3.2M8 11.6v.4" stroke="currentColor" stroke-width="1.4" />
        {:else}
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" />
        {/if}
      </svg>
      {verdictLabel}
    </span>
  </figcaption>

  <div class="ruler" aria-hidden="true">
    <span>0</span>
    <span>25%</span>
    <span>50%</span>
    <span>75%</span>
    <span>100%</span>
  </div>

  <div class="bar" aria-hidden="true">
    {#each segments as segment (segment.key)}
      <span class="bar__segment bar__segment--{segment.key}" style:inline-size="{segment.share}%"
      ></span>
    {/each}
  </div>

  <dl class="legend">
    {#each segments as segment (segment.key)}
      <div class="legend__row">
        <dt>
          <span class="swatch swatch--{segment.key}"></span>
          {segment.label}
        </dt>
        <dd class="num">
          {formatMemory(segment.value)}
          <span class="legend__share">{formatPercent(segment.value / budget.totalMb)}</span>
        </dd>
      </div>
    {/each}
  </dl>

  <p class="ledger__note">{verdictDetail}</p>
  <p class="ledger__note">
    Sustained load assumes {formatPercent(budget.workMemConcurrency / connections)} of
    {formatNumber(connections)} connections ({formatNumber(budget.workMemConcurrency)}) running one
    three-node sort or hash. Worst case at all {formatNumber(connections)} connections:
    <strong>{formatMemoryApprox(budget.worstCaseMb)}</strong>, including shared buffers and
    maintenance
    {#if connectionsAssumed}(connections assumed from the workload){/if}.
  </p>
</figure>

<style>
  .ledger {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-4);
    border: 1px solid var(--color-rule);
    background: var(--color-surface);
    min-inline-size: 0;
  }

  .ledger__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .ledger__head h3 {
    font-size: var(--text-md);
    font-weight: 600;
  }

  .verdict {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid currentColor;
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .verdict svg {
    inline-size: 0.875rem;
    block-size: 0.875rem;
  }

  .verdict--ok {
    color: var(--color-ok);
    background: var(--color-ok-soft);
  }

  .verdict--tight {
    color: var(--color-warn);
    background: var(--color-warn-soft);
  }

  .verdict--over {
    color: var(--color-danger);
    background: var(--color-danger-soft);
  }

  .ruler {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: var(--color-ink-faint);
    border-block-start: 1px solid var(--color-rule);
    padding-block-start: var(--space-1);
    margin-block-start: var(--space-1);
    position: relative;
  }

  .ruler span {
    position: relative;
  }

  .ruler span::before {
    content: '';
    position: absolute;
    inset-block-start: calc(var(--space-1) * -1 - 1px);
    inset-inline-start: 0;
    inline-size: 1px;
    block-size: var(--space-2);
    background: var(--color-rule-strong);
  }

  .bar {
    display: flex;
    block-size: 2.25rem;
    inline-size: 100%;
    border: 1px solid var(--color-ink);
    background: var(--color-paper);
  }

  .bar__segment {
    block-size: 100%;
    flex: none;
    min-inline-size: 0;
    border-inline-end: 1px solid var(--color-paper);
  }

  .bar__segment:last-child {
    border-inline-end: 0;
  }

  .bar__segment--sb {
    background: var(--color-accent);
  }

  .bar__segment--work {
    background: var(--color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }

  .bar__segment--maint {
    background:
      repeating-linear-gradient(
        45deg,
        var(--color-warn) 0,
        var(--color-warn) 1px,
        transparent 1px,
        transparent 6px
      ),
      var(--color-warn-soft);
  }

  .bar__segment--os {
    background: var(--color-surface-alt);
  }

  .legend {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
    margin: 0;
  }

  .legend__row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-1) var(--space-4);
    padding-block: var(--space-1);
    border-block-end: 1px solid var(--color-rule);
  }

  .legend__row:last-child {
    border-block-end: 0;
  }

  .legend dt {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-inline-size: 0;
    font-size: var(--text-sm);
    color: var(--color-ink);
  }

  .legend dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink);
    white-space: nowrap;
  }

  .legend__share {
    color: var(--color-ink-faint);
    margin-inline-start: var(--space-2);
  }

  .swatch {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    flex: none;
    border: 1px solid var(--color-ink);
  }

  .swatch--sb {
    background: var(--color-accent);
  }

  .swatch--work {
    background: var(--color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }

  .swatch--maint {
    background:
      repeating-linear-gradient(
        45deg,
        var(--color-warn) 0,
        var(--color-warn) 1px,
        transparent 1px,
        transparent 6px
      ),
      var(--color-warn-soft);
  }

  .swatch--os {
    background: var(--color-surface-alt);
  }

  .ledger__note {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
    max-inline-size: 70ch;
  }

  @media (max-width: 30rem) {
    .ledger__head {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-2);
    }
  }
</style>
