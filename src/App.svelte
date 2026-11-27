<script lang="ts">
  import { onMount } from 'svelte';
  import BrandMark from './components/BrandMark.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import { formatDate } from './lib/model/format';
  import {
    COPYRIGHT_HOLDER,
    COPYRIGHT_YEAR,
    INSPIRATION_URL,
    LICENSE_NAME,
    PUBLISHER_URL,
    REPO_URL,
    SITE_NAME,
    SITE_TITLE,
    SUPPORT_URL,
    lastUpdated,
    staticFile,
  } from './lib/model/meta';
  import { navigate, pathFor, route, startRouter, type Route } from './lib/router';
  import MethodPage from './routes/MethodPage.svelte';
  import TunePage from './routes/TunePage.svelte';

  onMount(() => startRouter());

  $effect(() => {
    document.title = $route === 'method' ? `Method: ${SITE_NAME}` : SITE_TITLE;
  });

  function go(event: MouseEvent, next: Route) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(next);
  }
</script>

<div class="shell">
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="topbar">
    <div class="page topbar__inner">
      <a class="brand" href={pathFor('tune')} onclick={(event) => go(event, 'tune')}>
        <BrandMark />
        <span>{SITE_NAME}</span>
      </a>

      <nav class="nav" aria-label="Main">
        <a
          href={pathFor('tune')}
          class:active={$route === 'tune'}
          aria-current={$route === 'tune' ? 'page' : undefined}
          onclick={(event) => go(event, 'tune')}
        >
          Tune
        </a>
        <a
          href={pathFor('method')}
          class:active={$route === 'method'}
          aria-current={$route === 'method' ? 'page' : undefined}
          onclick={(event) => go(event, 'method')}
        >
          Method
        </a>
      </nav>

      <div class="topbar__theme">
        <ThemeToggle />
      </div>
    </div>
  </header>

  <main id="main" tabindex="-1">
    {#if $route === 'method'}
      <MethodPage />
    {:else}
      <TunePage />
    {/if}
  </main>

  <footer class="footer">
    <div class="page footer__inner">
      <div class="footer__identity">
        <p class="footer__name">{SITE_NAME}</p>
        <p class="footer__meta">
          © {COPYRIGHT_YEAR} <a href={PUBLISHER_URL}>{COPYRIGHT_HOLDER}</a>
        </p>
        <p class="footer__meta">
          Site built <time datetime={lastUpdated()}>{formatDate(lastUpdated())}</time>
        </p>
      </div>
      <nav class="footer__links" aria-label="Project links">
        <a href={staticFile('LICENSE.txt')}>{LICENSE_NAME} license</a>
        <a href={staticFile('third-party-notices.txt')}>Third-party notices</a>
        <a href={REPO_URL}>View source on GitHub</a>
        <a href={SUPPORT_URL}>Support on Ko-fi</a>
      </nav>
    </div>
    <div class="page footer__credit">
      <p>
        Inspired by and partly derived from <a href={INSPIRATION_URL}>PGTune</a>, which is MIT
        licensed.
      </p>
    </div>
  </footer>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-block-size: 100svh;
  }

  .topbar {
    position: sticky;
    inset-block-start: 0;
    z-index: 20;
    background: var(--color-paper);
    border-block-end: 1px solid var(--color-rule);
  }

  .topbar__inner {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'brand nav theme';
    align-items: center;
    gap: var(--space-4);
    min-block-size: 4rem;
  }

  .brand {
    grid-area: brand;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-ink);
    text-decoration: none;
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .brand:hover {
    color: var(--color-accent);
  }

  .nav {
    grid-area: nav;
    display: flex;
    justify-content: center;
    gap: var(--space-5);
  }

  .nav a {
    display: inline-flex;
    align-items: center;
    min-block-size: 4rem;
    color: var(--color-ink-soft);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: 500;
    border-block-end: 2px solid transparent;
    border-block-start: 2px solid transparent;
  }

  .nav a:hover {
    color: var(--color-ink);
  }

  .nav a.active {
    color: var(--color-ink);
    border-block-end-color: var(--color-accent);
  }

  .topbar__theme {
    grid-area: theme;
    justify-self: end;
  }

  main {
    flex: 1;
  }

  main:focus {
    outline: none;
  }

  .footer {
    border-block-start: 1px solid var(--color-rule);
    margin-block-start: var(--space-12);
    padding-block: var(--space-6) var(--space-8);
  }

  .footer__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4) var(--space-8);
  }

  .footer__identity {
    display: grid;
    gap: 2px;
  }

  .footer__name {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: var(--leading-tight);
    color: var(--color-ink);
  }

  .footer__meta {
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
  }

  .footer__links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-5);
  }

  .footer__links a {
    display: inline-flex;
    align-items: center;
    min-block-size: 1.75rem;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-ink);
  }

  .footer__credit {
    margin-block-start: var(--space-5);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-rule);
  }

  .footer__credit p {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
    max-inline-size: 80ch;
  }

  @media (max-width: 46rem) {
    .topbar__inner {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        'brand theme'
        'nav nav';
      gap: var(--space-1) var(--space-4);
      padding-block-start: var(--space-2);
    }

    .nav {
      justify-content: flex-start;
      gap: var(--space-4);
      border-block-start: 1px solid var(--color-rule);
    }

    .nav a {
      min-block-size: 2.75rem;
    }
  }
</style>
