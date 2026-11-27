<script lang="ts">
  import { buildConfiguration, type ConfigFormat } from '../lib/model/configText';
  import type { TuningResult } from '../lib/model/types';
  import CopyButton from './CopyButton.svelte';

  let { result }: { result: TuningResult } = $props();

  let format = $state<ConfigFormat>('conf');
  let includeWarnings = $state(true);

  const build = $derived(buildConfiguration(result, { format, includeWarnings }));
  const hasWarnings = $derived(result.warnings.length > 0);

  const tabs: { id: ConfigFormat; label: string }[] = [
    { id: 'conf', label: 'postgresql.conf' },
    { id: 'alter', label: 'ALTER SYSTEM' },
  ];

  let tabButtons: (HTMLButtonElement | undefined)[] = $state([]);

  function selectTab(next: ConfigFormat, focus = false) {
    format = next;
    if (focus) {
      tabButtons[tabs.findIndex((tab) => tab.id === next)]?.focus();
    }
  }

  function onTabKeydown(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === format);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (next) {
      selectTab(next.id, true);
    }
  }
</script>

<div class="config">
  <div class="config__bar">
    <div class="tabs" role="tablist" aria-label="Configuration format">
      {#each tabs as tab, index (tab.id)}
        <button
          type="button"
          role="tab"
          id="config-tab-{tab.id}"
          aria-selected={format === tab.id}
          aria-controls="config-panel"
          tabindex={format === tab.id ? 0 : -1}
          class="tab"
          class:tab--active={format === tab.id}
          onclick={() => selectTab(tab.id)}
          onkeydown={onTabKeydown}
          bind:this={tabButtons[index]}
        >
          {tab.label}
        </button>
      {/each}
    </div>
    <CopyButton text={build.copyText} label="Copy" copiedLabel="Copied" />
  </div>

  <div
    id="config-panel"
    role="tabpanel"
    aria-labelledby="config-tab-{format}"
    tabindex="0"
    class="config__panel"
  >
    <p class="config__intro">
      {#if format === 'alter'}
        <strong>ALTER SYSTEM</strong> writes to <code>postgresql.auto.conf</code>, which is read in
        addition to <code>postgresql.conf</code>. Settings marked as restart required take effect
        after a server restart; the rest apply with <code>SELECT pg_reload_conf();</code>
      {:else}
        Add these settings to <code>postgresql.conf</code> and restart the server. Settings marked
        as restart required take effect only after the restart; the rest apply with
        <code>SELECT pg_reload_conf();</code>
      {/if}
    </p>

    <!-- Scrollable region: focusable so keyboard users can scroll it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="code-wrap" role="region" aria-label="Generated configuration" tabindex="0">
      <div class="code" aria-hidden="true">
        {#each build.lines as line, lineIndex (lineIndex)}
          <div class="code__line">
            {#each line as segment, segmentIndex (segmentIndex)}
              {#if segment.token}
                <span class="tok tok--{segment.token}">{segment.text}</span>
              {:else}
                {segment.text}
              {/if}
            {/each}
          </div>
        {/each}
      </div>
      <div class="visually-hidden">
        <pre>{build.displayText}</pre>
      </div>
    </div>

    {#if hasWarnings}
      <label class="include">
        <input type="checkbox" bind:checked={includeWarnings} />
        <span>Include warnings as comments when copying</span>
      </label>
    {/if}

    <div class="config__actions">
      <CopyButton
        text={build.copyText}
        label="Copy configuration"
        copiedLabel="Configuration copied"
        variant="primary"
      />
    </div>
  </div>
</div>

<style>
  .config {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    border: 1px solid var(--color-rule);
    background: var(--color-surface);
    min-inline-size: 0;
  }

  .config__bar {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: var(--space-3);
    border-block-end: 1px solid var(--color-rule);
    padding-inline: var(--space-3);
    padding-block-start: var(--space-2);
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
  }

  .tab {
    min-block-size: 2.5rem;
    padding: var(--space-1) var(--space-3);
    border: 0;
    border-block-end: 2px solid transparent;
    background: transparent;
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .tab:hover {
    color: var(--color-ink);
  }

  .tab--active {
    color: var(--color-ink);
    border-block-end-color: var(--color-accent);
    font-weight: 500;
  }

  .config__panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .config__panel:focus-visible {
    outline-offset: -2px;
  }

  .config__intro {
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
    max-inline-size: 72ch;
  }

  .config__intro code {
    font-size: 0.95em;
    color: var(--color-ink);
  }

  .code-wrap {
    border: 1px solid var(--color-rule);
    background: var(--color-paper);
    overflow-x: auto;
    min-inline-size: 0;
    max-block-size: 34rem;
    overflow-y: auto;
  }

  .code {
    min-inline-size: max-content;
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--leading-code);
    color: var(--color-ink);
  }

  .code__line {
    display: block;
    min-block-size: 1.7em;
    white-space: pre;
  }

  .tok--comment {
    color: var(--color-ink-faint);
    font-style: italic;
  }

  .tok--keyword {
    color: var(--color-accent);
    font-weight: 500;
  }

  .tok--name {
    color: var(--color-ink);
  }

  .tok--value {
    color: var(--color-accent);
  }

  .tok--note {
    color: var(--color-warn);
  }

  .include {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
    min-block-size: 1.5rem;
    cursor: pointer;
  }

  .include input {
    inline-size: 1.125rem;
    block-size: 1.125rem;
    margin-block-start: 0.15rem;
    accent-color: var(--color-accent);
    flex: none;
  }

  .config__actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 36rem) {
    .config__bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-2);
      padding-block-end: var(--space-2);
    }

    .config__bar > :global(.copy) {
      align-self: flex-end;
    }

    .tab {
      flex: 1;
    }

    .config__actions {
      justify-content: stretch;
    }

    .config__actions :global(.copy) {
      inline-size: 100%;
    }
  }
</style>
