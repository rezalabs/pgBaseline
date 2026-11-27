<script lang="ts">
  import { groupWarnings, WARNING_GROUP_TITLES } from '../lib/model/configText';
  import type { WarningItem } from '../lib/model/types';

  let { warnings }: { warnings: readonly WarningItem[] } = $props();

  const groups = $derived(groupWarnings(warnings));
</script>

{#if groups.length > 0}
  <div class="warnings">
    {#each groups as group (group.level)}
      <section class="warning warning--{group.level}" aria-labelledby="warning-group-{group.level}">
        <h3 id="warning-group-{group.level}" class="warning__title">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            {#if group.level === 'startup'}
              <path d="M8 1.5 15 14H1Z" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M8 6v3.4M8 11.7v.5" stroke="currentColor" stroke-width="1.5" />
            {:else if group.level === 'memory'}
              <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M8 4.6v4.1M8 10.9v.5" stroke="currentColor" stroke-width="1.5" />
            {:else}
              <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M8 7.2v4M8 4.9v.5" stroke="currentColor" stroke-width="1.5" />
            {/if}
          </svg>
          {WARNING_GROUP_TITLES[group.level].title}
        </h3>
        <ul role="list" class="warning__list">
          {#each group.warnings as warning, index (index)}
            <li class="warning__item">
              <p>{warning.text}</p>
              {#if warning.code}
                <code class="warning__code">{warning.code}</code>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style>
  .warnings {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .warning {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    border: 1px solid var(--color-rule);
    border-inline-start-width: 3px;
    background: var(--color-surface);
    padding: var(--space-3) var(--space-4);
  }

  .warning--startup {
    border-inline-start-color: var(--color-danger);
  }

  .warning--memory {
    border-inline-start-color: var(--color-warn);
  }

  .warning--note {
    border-inline-start-color: var(--color-accent);
  }

  .warning__title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink);
  }

  .warning__title svg {
    inline-size: 1rem;
    block-size: 1rem;
    color: var(--color-ink-soft);
  }

  .warning--startup .warning__title svg {
    color: var(--color-danger);
  }

  .warning--memory .warning__title svg {
    color: var(--color-warn);
  }

  .warning__list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    margin-block-start: var(--space-2);
    padding-inline-start: 0;
    list-style: none;
  }

  .warning__item {
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
    max-inline-size: 78ch;
    min-inline-size: 0;
  }

  .warning__code {
    display: block;
    margin-block-start: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-rule);
    background: var(--color-paper);
    font-size: var(--text-xs);
    color: var(--color-ink);
    max-inline-size: 100%;
    overflow-x: auto;
    white-space: pre;
  }
</style>
