import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { SITE_DESCRIPTION, SITE_TITLE } from './src/lib/model/meta.ts';

// GitHub Pages serves project sites from /<repository>/ and user sites from /.
// The Pages workflow passes the site's base path (/<repository> or empty), with
// or without a trailing slash; local development uses /.
const base = `${(process.env.BASE_PATH ?? '').replace(/\/+$/, '')}/`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const HTML_TOKENS: Record<string, string> = {
  '%SITE_TITLE%': SITE_TITLE,
  '%SITE_DESCRIPTION%': SITE_DESCRIPTION,
};

// The static shell is served before any JavaScript runs, so its title and
// description cannot come from a component. Both are injected from the same
// constants the hero uses, which keeps the shell and the page from drifting.
function htmlTokens(): Plugin {
  return {
    name: 'pgbaseline-html-tokens',
    transformIndexHtml(html) {
      let result = html;
      for (const [token, value] of Object.entries(HTML_TOKENS)) {
        result = result.replaceAll(token, () => escapeHtml(value));
      }
      if (/%SITE_[A-Z_]+%/.test(result)) {
        throw new Error('index.html holds a SITE_ token that vite.config.ts does not fill');
      }
      return result;
    },
  };
}

// Vitest resolves the node conditions by default, which picks Svelte's server
// build. The browser condition is what the test environment needs to mount
// components.
const isTest = Boolean(process.env.VITEST);

export default defineConfig({
  base,
  plugins: [svelte(), htmlTokens()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  ...(isTest ? { resolve: { conditions: ['browser'] } } : {}),
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    restoreMocks: true,
  },
});
