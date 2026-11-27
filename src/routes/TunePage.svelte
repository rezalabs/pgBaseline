<script lang="ts">
  import ConfigView from '../components/ConfigView.svelte';
  import CopyButton from '../components/CopyButton.svelte';
  import EvidenceList from '../components/EvidenceList.svelte';
  import Field from '../components/Field.svelte';
  import MemoryLedger from '../components/MemoryLedger.svelte';
  import SelectField from '../components/SelectField.svelte';
  import WarningList from '../components/WarningList.svelte';
  import { computeConfiguration } from '../lib/model/compute';
  import { formatDate, formatNumber } from '../lib/model/format';
  import {
    DB_SIZE_HINTS,
    DB_SIZE_LABELS,
    OS_LABELS,
    STORAGE_HINTS,
    STORAGE_LABELS,
    WORKLOAD_DESCRIPTIONS,
    WORKLOAD_LABELS,
  } from '../lib/model/labels';
  import { RESEARCH_DATE, SITE_DESCRIPTION } from '../lib/model/meta';
  import { DB_SIZES, MEMORY_UNITS, OS_TYPES, STORAGE_TYPES, WORKLOADS } from '../lib/model/types';
  import type { BudgetVerdict, DbSize, PgVersion, StorageType, Workload } from '../lib/model/types';
  import { PG_VERSIONS } from '../lib/model/types';
  import { VERSION_EOL, versionStatus } from '../lib/model/versions';
  import {
    DEFAULT_FORM_VALUES,
    EXAMPLES,
    formValuesFromParams,
    formValuesToInput,
    formValuesToParams,
    suggestedConnectionsFor,
    validateForm,
    type ExamplePreset,
    type FormValues,
  } from '../lib/urlState';

  let values = $state<FormValues>(
    formValuesFromParams(new URLSearchParams(window.location.search)),
  );
  let touched = $state({ ram: false, cpus: false, connections: false });

  const errors = $derived(validateForm(values));
  const input = $derived(formValuesToInput(values));
  const result = $derived(input === null ? null : computeConfiguration(input));
  const ramError = $derived(touched.ram || values.ram !== '' ? errors.ram : undefined);
  const cpusError = $derived(touched.cpus ? errors.cpus : undefined);
  const connectionsError = $derived(touched.connections ? errors.connections : undefined);
  const suggested = $derived(suggestedConnectionsFor(values));

  const today = new Date();
  const selectedVersion = $derived(Number(values.version) as PgVersion);
  const versionState = $derived(versionStatus(selectedVersion, today));
  const versionNote = $derived.by(() => {
    const end = formatDate(VERSION_EOL[selectedVersion]);
    if (versionState === 'current') {
      return `Current major release. Supported until ${end}.`;
    }
    if (versionState === 'eol') {
      return `End of life since ${end}.`;
    }
    if (versionState === 'eol-soon') {
      return `End of life on ${end}.`;
    }
    return `Supported until ${end}.`;
  });

  const versionOptions = PG_VERSIONS.map((version) => {
    const state = versionStatus(version, today);
    const suffix =
      state === 'current'
        ? ' (current)'
        : state === 'eol'
          ? ' (EOL)'
          : state === 'eol-soon'
            ? ' (EOL soon)'
            : '';
    return { value: String(version), label: `${version}${suffix}` };
  });

  const workloadOptions: readonly { value: Workload; label: string }[] = WORKLOADS.map(
    (workload) => ({ value: workload, label: WORKLOAD_LABELS[workload] }),
  );
  const storageOptions: readonly { value: StorageType; label: string }[] = STORAGE_TYPES.map(
    (storage) => ({ value: storage, label: STORAGE_LABELS[storage] }),
  );
  const dbSizeOptions: readonly { value: DbSize; label: string }[] = DB_SIZES.map((size) => ({
    value: size,
    label: DB_SIZE_LABELS[size],
  }));
  const unitOptions = MEMORY_UNITS.map((unit) => ({ value: unit, label: unit }));

  const workloadInfo = $derived(WORKLOAD_DESCRIPTIONS[values.workload]);
  const workloadHint = $derived(`${workloadInfo.summary} Examples: ${workloadInfo.examples}`);
  const storageHint = $derived(STORAGE_HINTS[values.storage]);
  const dbSizeHint = $derived(DB_SIZE_HINTS[values.dbSize]);
  const connectionPlaceholder = $derived(
    suggested > 0 ? `Optional, ${formatNumber(suggested)} if empty` : 'Optional',
  );

  const verdictSentence: Record<BudgetVerdict, string> = {
    ok: 'The sustained memory model leaves room for the OS.',
    tight: 'The all-connections worst case exceeds the available RAM.',
    over: 'The sustained model leaves too little memory for the OS.',
  };
  const resultSummary = $derived(
    result === null
      ? ''
      : `${result.settings.length} settings. ${verdictSentence[result.budget.verdict]}`,
  );

  const shareUrl = $derived.by(() => {
    const query = formValuesToParams(values).toString();
    return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
  });

  let liveMessage = $state('');
  let urlInitialised = false;

  $effect(() => {
    const query = formValuesToParams(values).toString();
    if (!urlInitialised) {
      urlInitialised = true;
      return;
    }
    const timer = setTimeout(() => {
      const current = `${window.location.pathname}${window.location.search}`;
      const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
      if (current !== next) {
        window.history.replaceState({ route: 'tune' }, '', next);
      }
    }, 350);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (result === null) {
      liveMessage = '';
      return;
    }
    const message = `Configuration updated. ${resultSummary}`;
    const timer = setTimeout(() => {
      liveMessage = message;
    }, 500);
    return () => clearTimeout(timer);
  });

  function reset() {
    values = { ...DEFAULT_FORM_VALUES };
    touched = { ram: false, cpus: false, connections: false };
  }

  function applyExample(example: ExamplePreset) {
    values = { ...example.values };
    touched = { ram: false, cpus: false, connections: false };
  }

  const describedBy = (hintId: string, error?: string): string =>
    error ? `${hintId} ${error}` : hintId;
</script>

<div class="tune page">
  <p class="visually-hidden" role="status" aria-live="polite">{liveMessage}</p>

  <header class="intro">
    <h1>PostgreSQL configuration</h1>
    <p class="intro__lead">{SITE_DESCRIPTION}</p>
    <p class="intro__meta">
      For PostgreSQL 10 through 19. Defaults and feature checks follow the release you pick.
    </p>
  </header>

  <div class="workspace">
    <section class="panel panel--form" aria-labelledby="form-title">
      <div class="panel__head">
        <h2 id="form-title">Your server</h2>
        <p>The configuration updates as you type. Memory is the only required field.</p>
      </div>

      <div class="form-grid">
        <div class="span-2">
          <Field label="PostgreSQL version" forId="version" hint={versionNote}>
            <SelectField
              id="version"
              bind:value={values.version}
              options={versionOptions}
              describedBy="version-hint"
            />
          </Field>
        </div>

        <div class="span-2">
          <Field
            label="Operating system"
            forId="os"
            group
            hint="Selects the asynchronous I/O method, where I/O concurrency applies, the pre-18 Windows memory cap, and the huge page guidance."
          >
            <div class="segmented">
              {#each OS_TYPES as os (os)}
                <label>
                  <input type="radio" name="os" value={os} bind:group={values.os} />
                  <span>{OS_LABELS[os]}</span>
                </label>
              {/each}
            </div>
          </Field>
        </div>

        <div class="span-2">
          <Field label="Workload" forId="workload" hint={workloadHint}>
            <SelectField
              id="workload"
              bind:value={values.workload}
              options={workloadOptions}
              describedBy="workload-hint"
            />
          </Field>
        </div>

        <div class="span-2">
          <Field
            label="Total memory (RAM)"
            forId="ram"
            hint="How much memory PostgreSQL can use. In a container, use the container limit."
            error={ramError}
          >
            <div class="memory-row">
              <input
                id="ram"
                class="control"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                pattern="[0-9]*"
                placeholder="64"
                bind:value={values.ram}
                onblur={() => (touched.ram = true)}
                aria-invalid={ramError ? 'true' : undefined}
                aria-describedby={describedBy('ram-hint', ramError ? 'ram-error' : undefined)}
              />
              <SelectField
                id="ram-unit"
                bind:value={values.ramUnit}
                options={unitOptions}
                ariaLabel="Memory unit"
              />
            </div>
          </Field>
        </div>

        <Field
          label="Number of CPUs"
          forId="cpus"
          optional
          hint="Leave empty to keep parallel settings at their defaults."
          error={cpusError}
        >
          <input
            id="cpus"
            class="control"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            pattern="[0-9]*"
            placeholder="e.g. 16"
            bind:value={values.cpus}
            onblur={() => (touched.cpus = true)}
            aria-invalid={cpusError ? 'true' : undefined}
            aria-describedby={describedBy('cpus-hint', cpusError ? 'cpus-error' : undefined)}
          />
        </Field>

        <Field
          label="Max connections"
          forId="connections"
          optional
          hint="Leave empty to assume a count from the workload."
          error={connectionsError}
        >
          <input
            id="connections"
            class="control"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            pattern="[0-9]*"
            placeholder={connectionPlaceholder}
            bind:value={values.connections}
            onblur={() => (touched.connections = true)}
            aria-invalid={connectionsError ? 'true' : undefined}
            aria-describedby={describedBy(
              'connections-hint',
              connectionsError ? 'connections-error' : undefined,
            )}
          />
        </Field>

        <Field label="Data storage" forId="storage" hint={storageHint}>
          <SelectField
            id="storage"
            bind:value={values.storage}
            options={storageOptions}
            describedBy="storage-hint"
          />
        </Field>

        <Field label="Database size" forId="db-size" hint={dbSizeHint}>
          <SelectField
            id="db-size"
            bind:value={values.dbSize}
            options={dbSizeOptions}
            describedBy="db-size-hint"
          />
        </Field>
      </div>

      <div class="form-foot">
        <button type="button" class="link-button" onclick={reset}>Reset</button>
        {#if result}
          <a class="jump" href="#result">View configuration</a>
        {/if}
      </div>
    </section>

    <section id="result" class="panel panel--result" aria-labelledby="result-title">
      <div class="result-head">
        <div>
          <h2 id="result-title">Starting configuration</h2>
          {#if result}
            <p class="result__summary">{resultSummary}</p>
          {/if}
        </div>
        {#if result}
          <CopyButton text={shareUrl} label="Copy link" copiedLabel="Link copied" />
        {/if}
      </div>

      {#if result}
        <div class="result-body">
          <MemoryLedger
            budget={result.budget}
            connections={result.connections}
            connectionsAssumed={result.connectionsAssumed}
          />
          <WarningList warnings={result.warnings} />
          <ConfigView {result} />
          <EvidenceList {result} />
          <ul class="footnotes">
            <li>Apply on a staging server first and compare against your current configuration.</li>
            <li>
              On a primary and standby pair, keep <code>max_connections</code> and
              <code>max_worker_processes</code> equal or higher on the standby.
            </li>
            <li>
              Settings marked restart required need a server restart. The rest apply with
              <code>SELECT pg_reload_conf();</code>.
            </li>
            <li>Model reviewed {formatDate(RESEARCH_DATE)}. Measure before and after.</li>
          </ul>
        </div>
      {:else}
        <div class="empty">
          <p class="empty__lead">Enter total memory to generate a configuration.</p>
          <p class="empty__body">
            The workload, CPU count, and connection count refine the result as you enter them. The
            configuration is computed in this tab, and the address bar holds your inputs so a link
            reproduces the result.
          </p>
          <ul class="empty__list">
            <li>A postgresql.conf block or an ALTER SYSTEM block</li>
            <li>A memory ledger with the sustained and worst-case view</li>
            <li>Warnings for startup, memory, and end-of-life risk</li>
          </ul>
          <h3>Try an example</h3>
          <div class="examples">
            {#each EXAMPLES as example (example.label)}
              <button type="button" class="example" onclick={() => applyExample(example)}>
                <span class="example__label">{example.label}</span>
                <span class="example__desc">{example.description}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .tune {
    padding-block: var(--space-8) var(--space-12);
  }

  .intro {
    display: grid;
    gap: var(--space-2);
    margin-block-end: var(--space-6);
    max-inline-size: 70ch;
  }

  .intro h1 {
    font-size: clamp(2.25rem, 4.4vw, 3.25rem);
    font-weight: 600;
  }

  .intro__lead {
    font-size: var(--text-lg);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
  }

  .intro__meta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-faint);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(20rem, 27rem) minmax(0, 1fr);
    align-items: start;
    border: 1px solid var(--color-rule);
    background: var(--color-paper);
  }

  .panel {
    min-inline-size: 0;
  }

  .panel--form {
    padding: var(--space-5);
    background: var(--color-surface);
    border-block-end: 1px solid var(--color-rule);
  }

  .panel--result {
    padding: var(--space-5);
    border-inline-start: 1px solid var(--color-rule);
  }

  #result {
    scroll-margin-block-start: 5rem;
  }

  .panel__head {
    display: grid;
    gap: var(--space-1);
    margin-block-end: var(--space-5);
  }

  .panel__head h2,
  .result-head h2 {
    font-size: var(--text-xl);
  }

  .panel__head p {
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .span-2 {
    grid-column: 1 / -1;
  }

  .memory-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 7.5rem;
    gap: var(--space-2);
  }

  .form-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-block-start: var(--space-5);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-rule);
  }

  .jump {
    display: none;
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .result-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-block-end: var(--space-5);
  }

  .result__summary {
    margin-block-start: var(--space-1);
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
    max-inline-size: 52ch;
  }

  .result-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }

  .empty {
    display: grid;
    gap: var(--space-4);
    max-inline-size: 48rem;
  }

  .empty__lead {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    line-height: var(--leading-tight);
  }

  .empty__body {
    color: var(--color-ink-soft);
    max-inline-size: 55ch;
  }

  .empty__list {
    display: grid;
    gap: var(--space-1);
    padding-inline-start: var(--space-5);
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
  }

  .empty__list li::marker {
    color: var(--color-rule-strong);
  }

  .empty h3 {
    font-family: var(--font-body);
    font-size: var(--text-md);
    font-weight: 600;
  }

  .examples {
    display: grid;
    gap: var(--space-2);
  }

  .example {
    display: grid;
    gap: 2px;
    padding: var(--space-3);
    border: 1px solid var(--color-control);
    background: var(--color-surface);
    text-align: start;
    transition:
      border-color var(--dur-fast) var(--ease),
      background-color var(--dur-fast) var(--ease);
  }

  .example:hover {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .example__label {
    font-weight: 600;
  }

  .example__desc {
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
  }

  .footnotes {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding-block-start: var(--space-3);
    padding-inline-start: 0;
    border-block-start: 1px solid var(--color-rule);
    list-style: none;
  }

  .footnotes li {
    position: relative;
    padding-inline-start: var(--space-4);
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
  }

  .footnotes li::before {
    content: '';
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0.5em;
    inline-size: 0.375rem;
    block-size: 0.375rem;
    background: var(--color-rule-strong);
  }

  .footnotes code {
    font-size: 0.95em;
    color: var(--color-ink);
  }

  @media (max-width: 72rem) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .panel--form {
      border-inline-end: 0;
      border-block-end: 1px solid var(--color-rule);
    }

    .panel--result {
      border-inline-start: 0;
    }

    .jump {
      display: inline-flex;
    }
  }

  @media (max-width: 34rem) {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .span-2 {
      grid-column: auto;
    }

    .memory-row {
      grid-template-columns: minmax(0, 1fr) 6rem;
    }

    .result-head {
      flex-direction: column;
    }

    .form-foot {
      flex-wrap: wrap;
    }
  }
</style>
