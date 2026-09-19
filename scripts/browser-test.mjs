import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : 'playwright');
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '5198' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000); server.stdout.once('data', () => { clearTimeout(timer); resolve(); }); server.once('error', reject); });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5198');
  await page.waitForSelector('body.specimens-ready');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/flower-landing.png', fullPage: true });
  await page.locator('#bloom-compare').fill('75');
  assert.match(await page.locator('#bloom-amount').textContent(), /75% original/);
  await page.goto('http://127.0.0.1:5198/studio.html');
  await page.waitForSelector('#welcome-dialog[open]');
  await page.screenshot({ path: 'test-results/flower-welcome.png' });
  await page.locator('#welcome-tour').click();
  for (let step = 0; step < 5; step++) {
    assert.equal(await page.locator('#tour-count').textContent(), `${step + 1} / 5`);
    const bounds = await page.locator('.tour-card').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1440);
    if (step === 1) await page.screenshot({ path: 'test-results/flower-tour.png' });
    await page.locator('#tour-next').click();
  }
  assert.equal(await page.locator('#tour-dialog').isVisible(), false);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#render-status').textContent.startsWith('Preview ready'));
  assert.equal(await page.locator('#welcome-dialog').isVisible(), false);
  const ready = async () => { await page.waitForFunction(() => document.querySelector('#render-status').textContent.startsWith('Preview ready'), { timeout: 20000 }); };
  await ready();
  assert.match(await page.locator('#glyph-count').textContent(), /characters/);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/studio-desktop.png', fullPage: true });
  await page.locator('[data-preset="terminal"]').click();
  await page.waitForFunction(() => document.querySelector('#foreground').value === '#b7f394');
  await ready();
  await page.locator('[data-view="split"]').click();
  assert.equal(await page.locator('#split-line').isVisible(), true);
  const imageBounds = await page.locator('#overlay').boundingBox();
  await page.mouse.move(imageBounds.x + imageBounds.width * 0.3, imageBounds.y + 50); await page.mouse.down(); await page.mouse.move(imageBounds.x + imageBounds.width * 0.7, imageBounds.y + 50); await page.mouse.up();
  const splitPosition = await page.locator('#split-line').evaluate(element => parseFloat(element.style.left)); assert.ok(splitPosition > 65);
  await page.locator('#mask-tab').click();
  await page.locator('[data-tool="rectangle"]').click();
  await page.mouse.move(imageBounds.x + 60, imageBounds.y + 60); await page.mouse.down(); await page.mouse.move(imageBounds.x + 160, imageBounds.y + 160); await page.mouse.up();
  assert.equal(await page.locator('#undo-mask').isEnabled(), true);
  await page.locator('#undo-mask').click(); assert.equal(await page.locator('#redo-mask').isEnabled(), true); await page.locator('#redo-mask').click();
  await page.locator('#look-tab').click();
  // Synthetic uploaded image provides an exact reference for lossless preservation.
  const fixture = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 160; c.height = 100; const x = c.getContext('2d'); x.fillStyle = '#197eb6'; x.fillRect(0, 0, 160, 100); x.fillStyle = '#ff982d'; x.fillRect(40, 20, 80, 60); return c.toDataURL().split(',')[1]; });
  await page.locator('#file-input').setInputFiles({ name: 'test-photo.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
  await page.waitForFunction(() => document.querySelector('#filename').textContent === 'test-photo'); await ready();
  assert.equal(await page.locator('#undo-mask').isEnabled(), false);
  if (process.env.TEST_AI === '1') {
    await page.locator('#mask-tab').click();
    await page.waitForFunction(() => !document.querySelector('#auto-mask').disabled);
    await page.locator('#auto-mask').click();
    await page.waitForFunction(() => document.querySelector('#ai-status').textContent.startsWith('Subject selected.'), null, { timeout: 300000 });
    assert.equal(await page.locator('#undo-mask').isEnabled(), true);
    await page.locator('#clear-mask').click(); await page.locator('#look-tab').click();
  }
  await page.locator('#reset').click();
  await page.locator('#replacement').evaluate(element => { element.value = '0'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150); await ready();
  for (const format of ['png', 'jpeg', 'webp', 'svg', 'txt']) {
    await page.locator('#export-open').click(); await page.locator('#format').selectOption(format);
    const downloading = page.waitForEvent('download'); await page.locator('#export-confirm').click(); const download = await downloading;
    const path = `test-results/${download.suggestedFilename()}`; await download.saveAs(path);
    const buffer = await readFile(path); assert.ok(buffer.length > 0, format);
    if (format === 'png') {
      const exact = await page.evaluate(async ({ base64, original }) => { const a = new Image(), b = new Image(); a.src = 'data:image/png;base64,' + base64; b.src = 'data:image/png;base64,' + original; await Promise.all([a.decode(), b.decode()]); const read = image => { const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; c.getContext('2d').drawImage(image, 0, 0); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; }; const aPixels = read(a), bPixels = read(b); return aPixels.every((value, i) => value === bPixels[i]); }, { base64: buffer.toString('base64'), original: fixture });
      assert.ok(exact, '0% replacement PNG must preserve every pixel');
    }
    if (format === 'svg') {
      assert.match(buffer.toString(), /<text /);
      const svgResult = await page.evaluate(async base64 => { const image = new Image(); image.src = 'data:image/svg+xml;base64,' + base64; await image.decode(); const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0); return [...ctx.getImageData(0, 0, 1, 1).data]; }, buffer.toString('base64'));
      assert.deepEqual(svgResult, [25, 126, 182, 255], 'SVG at zero replacement must retain the source');
    }
  }
  await page.locator('#mask-tab').click();
  await page.locator('#invert-mask').click(); // Fully protect image.
  await page.locator('#look-tab').click();
  await page.locator('#replacement').evaluate(element => { element.value = '1'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150); await ready();
  const corner = await page.locator('#preview').evaluate(c => [...c.getContext('2d').getImageData(0, 0, 1, 1).data]); assert.deepEqual(corner, [25, 126, 182, 255]);
  await page.locator('#save-preset').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#help').click(); await page.locator('#restart-tour').click();
  for (let step = 0; step < 5; step++) { await page.waitForTimeout(30); const bounds = await page.locator('.tour-card').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844, `Mobile tour ${step} fits`); await page.locator('#tour-next').click(); }
  await page.screenshot({ path: 'test-results/studio-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile must not overflow horizontally');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  await page.goto('http://127.0.0.1:5198'); await page.waitForSelector('body.specimens-ready');
  await page.screenshot({ path: 'test-results/flower-landing-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile landing fits');
  console.log('Browser regression passed: demo, presets, compare, mask undo/redo, upload, exact pixel preservation, all five exports, SVG decoding, mobile layout.');
} finally { await browser?.close(); server.kill(); }
