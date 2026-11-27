<script lang="ts">
  import { formatSettingValue } from '../lib/model/configText';
  import { settingDocUrl, SOURCES } from '../lib/model/sources';
  import type { TuningResult } from '../lib/model/types';

  let { result }: { result: TuningResult } = $props();
</script>

<section class="evidence" aria-labelledby="evidence-title">
  <div class="evidence__head">
    <h3 id="evidence-title">Why these values</h3>
    <p>Each rule links to the PostgreSQL documentation and the source behind it.</p>
  </div>

  <div class="evidence__list">
    {#each result.settings as setting (setting.key)}
      <details class="ev">
        <summary class="ev__summary">
          <span class="ev__key">{setting.key}</span>
          <span class="ev__value">{formatSettingValue(setting)}</span>
          {#if setting.restart}
            <span class="ev__badge ev__badge--restart">restart</span>
          {/if}
          {#if setting.key === 'max_wal_size'}
            <span class="ev__badge">disk space</span>
          {/if}
          <span class="ev__chevron" aria-hidden="true"></span>
        </summary>
        <div class="ev__body">
          <p class="ev__rationale">{setting.rationale}</p>
          <p class="ev__doc">
            <a
              href={settingDocUrl(setting.key, result.input.version)}
              target="_blank"
              rel="noopener noreferrer"
            >
              PostgreSQL {result.input.version} documentation for {setting.key}
            </a>
          </p>
          <ul role="list" class="ev__sources">
            {#each setting.sources as sourceId (sourceId)}
              <li>
                <a href={SOURCES[sourceId].url} target="_blank" rel="noopener noreferrer">
                  {SOURCES[sourceId].title}
                </a>
                {#if SOURCES[sourceId].note}
                  <span class="ev__source-note">{SOURCES[sourceId].note}</span>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      </details>
    {/each}
  </div>
</section>

<style>
  .evidence {
    display: grid;
    gap: var(--space-3);
  }

  .evidence__head {
    display: grid;
    gap: var(--space-1);
  }

  .evidence__head h3 {
    font-size: var(--text-md);
    font-weight: 600;
  }

  .evidence__head p {
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
    max-inline-size: 60ch;
  }

  .evidence__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-6);
    align-items: start;
    grid-auto-rows: min-content;
    border-block-start: 1px solid var(--color-rule);
  }

  .ev {
    border-block-end: 1px solid var(--color-rule);
  }

  .ev__summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: 2.75rem;
    padding-block: var(--space-2);
    cursor: pointer;
    list-style: none;
    transition: background-color var(--dur-fast) var(--ease);
  }

  .ev__summary:hover {
    background: var(--color-surface-alt);
  }

  .ev__summary:focus-visible {
    outline-offset: -2px;
  }

  .ev__summary::-webkit-details-marker {
    display: none;
  }

  .ev__summary::marker {
    content: '';
  }

  .ev__key {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink);
    flex: 1;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .ev__value {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-accent);
    white-space: nowrap;
  }

  .ev__badge {
    padding: 0 var(--space-1);
    border: 1px solid var(--color-rule-strong);
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: var(--color-ink-soft);
    white-space: nowrap;
  }

  .ev__badge--restart {
    border-color: var(--color-warn);
    color: var(--color-warn);
  }

  .ev__chevron {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    flex: none;
    position: relative;
  }

  .ev__chevron::before,
  .ev__chevron::after {
    content: '';
    position: absolute;
    background: var(--color-ink-soft);
  }

  .ev__chevron::before {
    inset-block-start: 50%;
    inset-inline: 0;
    block-size: 1px;
  }

  .ev__chevron::after {
    inset-inline-start: 50%;
    inset-block: 0;
    inline-size: 1px;
    transition: transform var(--dur-fast) var(--ease);
  }

  .ev[open] .ev__chevron::after {
    transform: scaleY(0);
  }

  .ev__body {
    display: grid;
    gap: var(--space-2);
    padding-block-end: var(--space-3);
    padding-inline-end: var(--space-4);
    max-inline-size: 78ch;
  }

  .ev__rationale {
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
  }

  .ev__doc a,
  .ev__sources a {
    font-size: var(--text-xs);
  }

  .ev__sources {
    display: grid;
    gap: var(--space-1);
    padding-inline-start: 0;
    list-style: none;
  }

  .ev__source-note {
    display: block;
    font-size: var(--text-2xs);
    color: var(--color-ink-faint);
  }

  @media (max-width: 75rem) {
    .evidence__list {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 40rem) {
    .evidence__head {
      gap: var(--space-1);
    }

    .evidence__head p {
      text-align: start;
    }

    .ev__summary {
      flex-wrap: wrap;
    }

    .ev__key {
      flex-basis: 100%;
    }
  }
</style>
