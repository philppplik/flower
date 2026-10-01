import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(root, 'dist');
// Only this dedicated generated directory can be cleaned.
if (path.dirname(destination) !== root || path.basename(destination) !== 'dist') throw new Error('Unsafe build destination.');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
// Explicit allowlist: never publish the local server, models, uploads, or environment.
for (const entry of ['index.html', 'studio.html', 'src', 'assets', 'LICENSE', 'impressum.html', 'datenschutz.html', 'CNAME', 'robots.txt', 'sitemap.xml', 'llms.txt']) await cp(path.join(root, entry), path.join(destination, entry), { recursive: true });
const studioPath = path.join(destination, 'studio.html');
await writeFile(studioPath, (await readFile(studioPath, 'utf8')).replace('<html lang="en">', '<html lang="en" data-runtime="static">'));
await writeFile(path.join(destination, '.nojekyll'), '');
await writeFile(path.join(destination, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Flower — Not found</title><body style="font-family:Georgia;background:#f6f3eb;color:#29382d;padding:10vw"><h1>A little off the garden path.</h1><p>This page has moved or does not exist.</p><a href="https://flower.philipp-paulik.de/">Back to Flower →</a></body></html>');
console.log('Flower landing page and browser studio built in dist/.');
