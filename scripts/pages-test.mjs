import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import './build-pages.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : 'playwright');
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    const relative = new URL(request.url, 'http://localhost').pathname.replace(/^\/flower\//, '');
    const file = path.resolve(root, relative || 'index.html');
    if (!file.startsWith(root + path.sep)) { response.writeHead(404); response.end(); return; }
    const data = await readFile(file); response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(5200, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage(); const errors = [], apiCalls = [], badResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/')) apiCalls.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
  await page.goto('http://127.0.0.1:5200/flower/'); await page.waitForSelector('body.specimens-ready');
  await page.locator('[data-look="dusk"]').click(); await page.waitForSelector('#welcome-dialog[open]'); await page.locator('#welcome-skip').click();
  await page.waitForFunction(() => document.querySelector('#render-status').textContent.startsWith('Preview ready'));
  assert.equal(await page.locator('[data-preset="dusk"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#mask-tab').click(); assert.equal(await page.locator('#auto-mask').isDisabled(), true);
  assert.match(await page.locator('#ai-status').textContent(), /local edition/);
  await page.locator('#export-open').click();
  const downloading = page.waitForEvent('download'); await page.locator('#export-confirm').click(); const downloaded = await downloading; assert.match(downloaded.suggestedFilename(), /\.png$/);
  assert.deepEqual(apiCalls, []); assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  console.log('GitHub Pages subpath regression passed: landing, preset deep link, worker rendering, hosted AI messaging, PNG export, zero API requests or missing assets.');
} finally { await browser?.close(); server.close(); }
