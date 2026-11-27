<script lang="ts">
  import { onMount } from 'svelte';
  import { applyTheme, currentTheme, storedTheme, systemTheme, type Theme } from '../lib/theme';

  let theme = $state<Theme>('light');

  onMount(() => {
    theme = currentTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (storedTheme() === null) {
        const next = systemTheme();
        applyTheme(next, false);
        theme = next;
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });

  function toggle() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme, true);
  }
</script>

<button
  type="button"
  class="theme-toggle"
  aria-pressed={theme === 'dark'}
  onclick={toggle}
  title="Toggle dark mode"
>
  {#if theme === 'dark'}
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.6" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      />
    </svg>
  {:else}
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M16.5 12.4A6.8 6.8 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
  <span>Dark mode</span>
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: 2.25rem;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-control);
    border-radius: var(--radius);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    font-weight: 500;
    transition:
      background-color var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }

  .theme-toggle:hover {
    border-color: var(--color-ink-soft);
    color: var(--color-ink);
  }

  .theme-toggle[aria-pressed='true'] {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .theme-toggle svg {
    inline-size: 1rem;
    block-size: 1rem;
  }
</style>
