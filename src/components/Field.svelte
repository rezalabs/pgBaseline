<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    forId,
    hint,
    error,
    optional = false,
    group = false,
    children,
  }: {
    label: string;
    forId?: string;
    hint?: string | undefined;
    error?: string | undefined;
    optional?: boolean;
    group?: boolean;
    children: Snippet;
  } = $props();

  const hintId = $derived(forId ? `${forId}-hint` : undefined);
  const errorId = $derived(forId ? `${forId}-error` : undefined);

  const describedBy = $derived(
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined,
  );
</script>

{#if group}
  <fieldset class="field field--group" aria-describedby={describedBy}>
    <legend class="field__label">
      {label}
      {#if optional}<span class="field__optional">Optional</span>{/if}
    </legend>
    {#if hint}
      <p class="field__hint" id={hintId}>{hint}</p>
    {/if}
    {@render children()}
    {#if error}
      <p class="field__error" id={errorId}>{error}</p>
    {/if}
  </fieldset>
{:else}
  <div class="field" class:field--invalid={Boolean(error)}>
    <div class="field__head">
      <label for={forId}>{label}</label>
      {#if optional}
        <span class="field__optional">Optional</span>
      {/if}
    </div>
    {#if hint}
      <p class="field__hint" id={hintId}>{hint}</p>
    {/if}
    {@render children()}
    {#if error}
      <p class="field__error" id={errorId}>{error}</p>
    {/if}
  </div>
{/if}

<style>
  .field {
    display: grid;
    gap: var(--space-2);
    align-content: start;
    min-inline-size: 0;
  }

  .field--group {
    margin: 0;
    padding: 0;
    border: 0;
  }

  .field__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .field__head label,
  .field__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    inline-size: 100%;
    padding: 0;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink);
  }

  .field__optional {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    font-weight: 400;
    color: var(--color-ink-faint);
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  .field__hint {
    margin-block-start: calc(var(--space-1) * -1);
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
    max-inline-size: 44ch;
  }

  .field__error {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-danger);
    font-weight: 500;
  }
</style>
