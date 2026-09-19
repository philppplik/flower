import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, parsePreset } from '../src/core/settings.js';
import { analyzeImage, compositePixels, luminance, tone, colorAt, randomAt } from '../src/core/engine.js';
import { paintStroke, fillRectangle, selectRegion, refineMask, MaskHistory } from '../src/core/mask.js';
import { createSvg, escapeXml } from '../src/core/svg.js';
const rgba = (width, height, color) => new Uint8ClampedArray(Array.from({ length: width * height }, () => color).flat());

test('settings reject malformed roots and clamp imported values', () => {
  assert.throws(() => normalizeSettings(null)); assert.throws(() => normalizeSettings([]));
  const s = normalizeSettings({ size: -1, gamma: Infinity, background: 'url(evil)', colorMode: 'bad', characters: '\n@@..', unknown: true });
  assert.equal(s.size, 3); assert.equal(s.gamma, 1); assert.equal(s.background, DEFAULTS.background); assert.equal(s.characters, '@.'); assert.equal(s.unknown, undefined);
});
test('look import requires versioned data and removes unsafe text', () => {
  assert.throws(() => parsePreset('{}')); assert.throws(() => parsePreset('{'));
  assert.equal(parsePreset(JSON.stringify({ version: 1, settings: { size: 20 } })).size, 20);
  assert.equal(normalizeSettings({ characters: '  ' }).characters, DEFAULTS.characters);
});
test('luminance and tone handle black, white, and clipped adjustment', () => {
  assert.equal(luminance(0, 0, 0), 0); assert.ok(Math.abs(luminance(255, 255, 255) - 1) < 1e-12);
  assert.equal(tone(0, DEFAULTS), 0); assert.equal(tone(1, DEFAULTS), 1); assert.equal(tone(0.5, DEFAULTS), 0.5);
});
test('color modes apply monochrome, gradients, desaturation, quantization', () => {
  assert.deepEqual(colorAt([255, 0, 0], 0.5, { ...DEFAULTS, colorMode: 'mono', foreground: '#123456' }), [18, 52, 86]);
  assert.deepEqual(colorAt([0, 0, 0], 0.5, { ...DEFAULTS, colorMode: 'gradient', foreground: '#000000', highlight: '#ffffff' }), [128, 128, 128]);
  const gray = colorAt([100, 180, 220], 0.5, { ...DEFAULTS, saturation: 0 }); assert.equal(gray[0], gray[1]); assert.equal(gray[1], gray[2]);
  assert.deepEqual(colorAt([80, 160, 250], 0.5, { ...DEFAULTS, saturation: 1, colorMode: 'palette' }), [85, 170, 255]);
});
test('image analysis uses the full grid, including incomplete edge cells', () => {
  const result = analyzeImage(rgba(7, 9, [255, 255, 255, 255]), 7, 9, { ...DEFAULTS, size: 3, spacingX: 1, spacingY: 1, edgeAware: false }, [' ', '@']);
  assert.equal(result.cols, 4); assert.equal(result.rows, 3); assert.equal(result.cells.length, 12); assert.deepEqual(result.lines, ['@@@@', '@@@@', '@@@@']);
});
test('transparent pixels produce no glyphs and invalid image buffers fail', () => {
  assert.equal(analyzeImage(rgba(4, 4, [255, 255, 255, 0]), 4, 4, DEFAULTS).cells.length, 0);
  assert.throws(() => analyzeImage(new Uint8Array(2), 4, 4, DEFAULTS));
  assert.throws(() => analyzeImage(rgba(1, 1, [0, 0, 0, 255]), 1, 1, DEFAULTS, []));
});
test('density is deterministic and low density produces fewer cells', () => {
  const image = rgba(80, 80, [255, 255, 255, 255]); const settings = { ...DEFAULTS, size: 4, density: 0.4 };
  const a = analyzeImage(image, 80, 80, settings); assert.deepEqual(a, analyzeImage(image, 80, 80, settings));
  assert.ok(a.cells.length < analyzeImage(image, 80, 80, { ...settings, density: 1 }).cells.length);
  assert.equal(randomAt(20, 30), randomAt(20, 30));
});
test('dark ink on light paper uses less ink for bright source pixels', () => {
  const s = { ...DEFAULTS, colorMode: 'mono', foreground: '#000000', background: '#ffffff' };
  assert.equal(analyzeImage(rgba(4, 4, [255, 255, 255, 255]), 4, 4, s, [' ', '@']).cells.length, 0);
});
test('protected pixels retain exactly the original RGBA bytes', () => {
  const source = new Uint8ClampedArray([12, 34, 56, 127, 78, 90, 23, 255]); const effect = rgba(2, 1, [255, 255, 255, 255]);
  assert.deepEqual(compositePixels(source, effect, new Uint8Array([255, 0]), DEFAULTS), new Uint8ClampedArray([12, 34, 56, 127, 255, 255, 255, 255]));
});
test('replacement zero is identity for every mask mode, including source alpha zero', () => {
  const source = new Uint8ClampedArray([12, 34, 56, 0]);
  for (const mode of ['none', 'protect', 'apply']) assert.deepEqual(compositePixels(source, rgba(1, 1, [255, 0, 0, 255]), new Uint8Array([100]), { ...DEFAULTS, replacement: 0, maskMode: mode }), source);
});
test('apply-only mask reverses protection semantics', () => {
  const source = rgba(2, 1, [10, 10, 10, 255]), effect = rgba(2, 1, [250, 250, 250, 255]);
  assert.deepEqual([...compositePixels(source, effect, new Uint8Array([255, 0]), { ...DEFAULTS, maskMode: 'apply' })], [250, 250, 250, 255, 10, 10, 10, 255]);
});
test('compositing uses premultiplied alpha to avoid transparent-color halos', () => {
  const result = compositePixels(new Uint8ClampedArray([255, 0, 0, 0]), new Uint8ClampedArray([0, 0, 255, 255]), new Uint8Array([0]), { ...DEFAULTS, replacement: 0.5 });
  assert.deepEqual([...result], [0, 0, 255, 128]);
  assert.throws(() => compositePixels(new Uint8Array(4), new Uint8Array(8), new Uint8Array(1), DEFAULTS));
});
test('brush paints continuous strokes and erases without leaving canvas bounds', () => {
  const mask = new Uint8ClampedArray(100); paintStroke(mask, 10, 10, { x: -2, y: 5 }, { x: 9, y: 5 }, 1);
  assert.equal(mask[50], 255); assert.equal(mask[59], 255); assert.equal(mask[0], 0);
  paintStroke(mask, 10, 10, { x: 5, y: 5 }, { x: 5, y: 5 }, 1, true); assert.equal(mask[55], 0);
});
test('rectangle works in either drag direction and clips coordinates', () => {
  const mask = new Uint8ClampedArray(25); fillRectangle(mask, 5, 5, { x: 4, y: 4 }, { x: 2, y: 2 }); assert.equal(mask.filter(v => v).length, 9);
  fillRectangle(mask, 5, 5, { x: -5, y: -5 }, { x: 10, y: 10 }, true); assert.equal(mask.filter(v => v).length, 0);
});
test('color-region selects only connected matching pixels without wrapping rows', () => {
  const image = rgba(3, 2, [0, 0, 0, 255]); image.set([255, 255, 255, 255], 4); image.set([255, 255, 255, 255], 16);
  const mask = new Uint8ClampedArray(6); selectRegion(image, mask, 3, 2, 0, 0, 5);
  assert.deepEqual([...mask], [255, 0, 0, 255, 0, 0]);
  selectRegion(image, mask, 3, 2, 0, 0, 5, true); assert.equal(mask.filter(v => v).length, 0);
});
test('dilation expands a mask; erosion contracts it; refinement never mutates source', () => {
  const mask = new Uint8ClampedArray(25); mask[12] = 255;
  const expanded = refineMask(mask, 5, 5, 1, 0); assert.equal(expanded.filter(v => v).length, 9); assert.equal(mask.filter(v => v).length, 1);
  assert.deepEqual(refineMask(expanded, 5, 5, -1, 0), mask);
});
test('feather yields intermediate values and preserves uniform masks at borders', () => {
  const mask = new Uint8ClampedArray(25); mask[12] = 255;
  const blurred = refineMask(mask, 5, 5, 0, 1); assert.ok(blurred[12] > 0 && blurred[12] < 255);
  assert.deepEqual(refineMask(new Uint8ClampedArray(25).fill(255), 5, 5, 20, 20), new Uint8ClampedArray(25).fill(255));
});
test('undo/redo copy snapshots, discard redo branches, and bound memory', () => {
  const history = new MaskHistory(6); let mask = new Uint8ClampedArray([0, 0]);
  history.push(mask); mask[0] = 255; mask = history.undo(mask); assert.deepEqual([...mask], [0, 0]);
  mask = history.redo(mask); assert.deepEqual([...mask], [255, 0]);
  for (let i = 0; i < 10; i++) history.push(mask); assert.equal(history.past.length, 3); assert.equal(history.future.length, 0);
  history.clear(); assert.equal(history.past.length, 0);
});
test('SVG escapes custom glyphs and rejects external resource URLs', () => {
  const a = { width: 20, height: 20, fontSize: 10, cells: [{ char: '<', x: 1, y: 2, color: [255, 255, 255], alpha: 1, brightness: 1 }] };
  const png = 'data:image/png;base64,AAAA'; const svg = createSvg(a, DEFAULTS, png, png, png);
  assert.match(svg, /<text[^>]*>&lt;<\/text>/); assert.ok(!svg.includes('>\u003c</text>'));
  assert.equal(escapeXml('<&"\''), '&lt;&amp;&quot;&apos;'); assert.throws(() => createSvg(a, DEFAULTS, 'https://example.com/x', png, png));
});
