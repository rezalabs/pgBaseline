<script lang="ts">
  import { onDestroy } from 'svelte';
  import { copyToClipboard } from '../lib/clipboard';

  let {
    text,
    label = 'Copy',
    copiedLabel = 'Copied',
    variant = 'quiet',
  }: {
    text: string;
    label?: string;
    copiedLabel?: string;
    variant?: 'quiet' | 'primary';
  } = $props();

  type CopyState = 'idle' | 'copied' | 'failed';
  let state = $state<CopyState>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    const copied = await copyToClipboard(text);
    state = copied ? 'copied' : 'failed';
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      state = 'idle';
    }, 2000);
  }

  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
</script>

<button type="button" class="copy copy--{variant}" onclick={copy}>
  {#if state === 'copied'}
    {copiedLabel}
  {:else if state === 'failed'}
    Copy failed
  {:else}
    {label}
  {/if}
</button>
<span class="visually-hidden" role="status" aria-live="polite">
  {#if state === 'copied'}Copied to clipboard{:else if state === 'failed'}Could not copy to the
    clipboard{/if}
</span>

<style>
  .copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: 2.25rem;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.02em;
    transition:
      background-color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }

  .copy--quiet {
    border: 1px solid var(--color-control);
    background: transparent;
    color: var(--color-ink-soft);
  }

  .copy--quiet:hover {
    border-color: var(--color-ink-soft);
    color: var(--color-ink);
    background: var(--color-surface-alt);
  }

  .copy--primary {
    border: 1px solid var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 500;
  }

  .copy--primary:hover {
    background: var(--color-accent-strong);
    border-color: var(--color-accent-strong);
  }
</style>
