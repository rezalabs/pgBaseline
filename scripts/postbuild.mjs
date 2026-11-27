import { copyFile, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const shell = new URL('dist/index.html', root);

// GitHub Pages has no rewrite rules. A directory copy of the shell gives the
// method route a 200 response with its own title, and 404.html keeps unknown
// paths inside the app.
const ROUTES = [
  {
    dir: 'method',
    title: 'Method: pgBaseline',
    description:
      'How pgBaseline derives PostgreSQL settings: the rules, the memory ledger, version support, and every source behind the result.',
  },
];

const TITLE = /<title>[^<]*<\/title>/;
const DESCRIPTION = /(<meta\s+name="description"\s+content=")[^"]*(")/;
const OG_TITLE = /(<meta\s+property="og:title"\s+content=")[^"]*(")/;
const OG_DESCRIPTION = /(<meta\s+property="og:description"\s+content=")[^"]*(")/;

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const shellHtml = await readFile(shell, 'utf8');
for (const pattern of [TITLE, DESCRIPTION, OG_TITLE, OG_DESCRIPTION]) {
  if (!pattern.test(shellHtml)) {
    throw new Error('Postbuild: the app shell is missing a title, description, or Open Graph tag');
  }
}

for (const page of ROUTES) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const html = shellHtml
    .replace(TITLE, `<title>${title}</title>`)
    .replace(DESCRIPTION, (_match, start, end) => `${start}${description}${end}`)
    .replace(OG_TITLE, (_match, start, end) => `${start}${title}${end}`)
    .replace(OG_DESCRIPTION, (_match, start, end) => `${start}${description}${end}`);
  const dir = new URL(`${page.dir}/`, dist);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), html, 'utf8');
  process.stdout.write(`Postbuild: wrote dist/${page.dir}/index.html\n`);
}

await copyFile(shell, new URL('dist/404.html', root));
process.stdout.write('Postbuild: copied dist/index.html to dist/404.html\n');

for (const [from, to] of [
  ['LICENSE', 'dist/LICENSE.txt'],
  ['THIRD-PARTY-NOTICES.md', 'dist/third-party-notices.txt'],
]) {
  const source = new URL(from, root);
  const target = new URL(to, root);
  try {
    await access(source, constants.R_OK);
    await copyFile(source, target);
    process.stdout.write(`Postbuild: copied ${from} to ${to}\n`);
  } catch (error) {
    process.stderr.write(`Postbuild: could not copy ${from} to ${to}\n`);
    throw error;
  }
}
