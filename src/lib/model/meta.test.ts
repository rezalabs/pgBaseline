import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_DESCRIPTION, SITE_TITLE } from './meta';

// Vitest runs with the project root as the working directory, so the files the
// site is built and published from resolve from there.
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('one-line description', () => {
  it('is the package description', () => {
    const pkg = JSON.parse(read('package.json')) as { description: string };
    expect(pkg.description).toBe(SITE_DESCRIPTION);
  });

  it('opens the README', () => {
    const firstParagraph = read('README.md').split('\n\n')[1]?.trim();
    expect(firstParagraph).toBe(SITE_DESCRIPTION);
  });

  it('reaches the static shell through the build tokens', () => {
    const shell = read('index.html');
    expect(shell).toContain('%SITE_TITLE%');
    expect(shell).toContain('%SITE_DESCRIPTION%');
    expect(shell).not.toContain(SITE_TITLE);
    expect(shell).not.toContain(SITE_DESCRIPTION);
  });
});
