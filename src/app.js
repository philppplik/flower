import { DEFAULTS, PRESETS, CHARSETS, normalizeSettings, parsePreset, clamp } from './core/settings.js';
import { paintStroke, fillRectangle, selectRegion, refineMask, MaskHistory } from './core/mask.js';
import { createSvg } from './core/svg.js';
import { canvas, orderCharacters, renderComposite, maskCanvas, resizeMask, toBlob, download } from './render.js';
import { setupOnboarding } from './onboarding.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let settings = { ...DEFAULTS }, source, pixels, original, mask, rendered, analysis;
let name = 'Alpine study', view = 'result', panel = 'look', tool = 'brush', split = 0.5;
let brushSize = 42, tolerance = 32, generation = 0, loadingGeneration = 0, busy = false, scheduled = 0;
let pointer = null, previewOriginal = false, activeLook = 'field';
let sourceVersion = 0;
const history = new MaskHistory();
const preview = $('#preview'), overlay = $('#overlay');
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
worker.onmessage = ({ data }) => { const job = pending.get(data.id); if (job) { pending.delete(data.id); data.error ? job.reject(new Error(data.error)) : job.resolve(data.result); } };
worker.onerror = () => { for (const job of pending.values()) job.reject(new Error('The rendering worker failed. Reload the studio to retry.')); pending.clear(); };
let jobId = 0;
function analyzeAsync(image, config, scale = 1) {
  const id = ++jobId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, pixels: image.data, width: image.width, height: image.height, settings: config, characters: orderCharacters(config.characters, config.autoOrder), scale }); });
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 6000); }
function fail(error) { console.error(error); toast(error.message || 'Something went wrong. Please try again.'); }
const percent = v => `${Math.round(v * 100)}%`;
const px = v => `${v} px`;
const factor = v => `${Number(v).toFixed(2)}×`;
const controls = [
  ['character-controls', 'size', 'Glyph size', 3, 80, 1, px],
  ['advanced-character-controls', 'spacingX', 'Horizontal spacing', 0.6, 2, 0.05, factor],
  ['advanced-character-controls', 'spacingY', 'Vertical spacing', 0.6, 2, 0.05, factor],
  ['character-controls', 'density', 'Character density', 0.1, 1, 0.01, percent],
  ['advanced-character-controls', 'rotation', 'Rotation', -90, 90, 1, v => `${v}°`],
  ['advanced-character-controls', 'edgeStrength', 'Edge sensitivity', 0, 1, 0.01, percent],
  ['color-controls', 'contrast', 'Contrast', 0.2, 3, 0.05, factor],
  ['color-controls', 'brightness', 'Brightness', -0.5, 0.5, 0.01, percent],
  ['color-controls', 'gamma', 'Gamma', 0.2, 3, 0.05, factor],
  ['color-controls', 'saturation', 'Saturation', 0, 2, 0.05, factor],
  ['effect-controls', 'glow', 'Glow intensity', 0, 1, 0.01, percent],
  ['effect-controls', 'glowRadius', 'Glow radius', 0, 20, 1, px],
  ['effect-controls', 'glowThreshold', 'Highlight threshold', 0, 1, 0.01, percent],
  ['effect-controls', 'grain', 'Film grain', 0, 0.3, 0.01, percent],
  ['effect-controls', 'scanlines', 'Scanlines', 0, 0.8, 0.01, percent],
  ['effect-controls', 'vignette', 'Vignette', 0, 1, 0.01, percent],
  ['composition-controls', 'replacement', 'ASCII replacement', 0, 1, 0.01, percent],
  ['composition-controls', 'originalOpacity', 'Original underlay', 0, 1, 0.01, percent],
  ['composition-controls', 'asciiOpacity', 'Character opacity', 0, 1, 0.01, percent],
  ['mask-controls', 'brushSize', 'Brush diameter', 4, 200, 1, px],
  ['mask-controls', 'tolerance', 'Region tolerance', 1, 120, 1, v => `${v}`],
  ['mask-controls', 'feather', 'Feather edges', 0, 20, 1, px],
  ['mask-controls', 'expansion', 'Expand / contract', -20, 20, 1, px],
];
for (const [container, key, label, min, max, step] of controls) {
  const wrapper = document.createElement('div'); wrapper.className = 'control';
  wrapper.innerHTML = `<div class="control-top"><label for="${key}">${label}</label><output for="${key}" id="${key}-value"></output></div><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" />`;
  $(`#${container}`).append(wrapper);
  $(`#${key}`).addEventListener('input', event => {
    if (key === 'brushSize') brushSize = +event.target.value;
    else if (key === 'tolerance') tolerance = +event.target.value;
    else { settings[key] = +event.target.value; activeLook = null; scheduleRender(); }
    syncControls();
  });
}
for (const [id, preset] of Object.entries(PRESETS)) {
  const button = document.createElement('button'); button.className = 'preset'; button.dataset.preset = id;
  button.innerHTML = `<span class="preset-art">${preset.sample}</span><span class="preset-label">${preset.label}<small>${preset.subtitle}</small></span>`;
  button.onclick = () => { settings = { ...preset.settings, maskMode: settings.maskMode, feather: settings.feather, expansion: settings.expansion }; activeLook = id; syncControls(); scheduleRender(); };
  $('#presets').append(button);
}
function syncControls() {
  for (const [, key, , min, max, , format] of controls) {
    const value = key === 'brushSize' ? brushSize : key === 'tolerance' ? tolerance : settings[key];
    $(`#${key}`).value = value; $(`#${key}`).style.setProperty('--fill', `${(value - min) / (max - min) * 100}%`); $(`#${key}-value`).textContent = format(value);
  }
  for (const key of ['autoOrder', 'edgeAware', 'transparent']) $(`#${key}`).checked = settings[key];
  for (const key of ['foreground', 'background', 'highlight', 'characters']) $(`#${key}`).value = settings[key];
  $('#charset').value = Object.entries(CHARSETS).find(([, value]) => value === settings.characters)?.[0] || 'custom';
  $('#mask-mode').value = settings.maskMode;
  $$('.preset').forEach(button => { button.classList.toggle('active', button.dataset.preset === activeLook); button.setAttribute('aria-pressed', button.dataset.preset === activeLook); });
  $$('[data-color]').forEach(button => { button.classList.toggle('active', button.dataset.color === settings.colorMode); button.setAttribute('aria-pressed', button.dataset.color === settings.colorMode); });
  $('#undo-mask').disabled = !history.past.length; $('#redo-mask').disabled = !history.future.length;
  $('#foreground').disabled = settings.colorMode === 'original' || settings.colorMode === 'palette';
  $('#highlight').disabled = settings.colorMode !== 'gradient';
  $('#saturation').disabled = settings.colorMode === 'mono' || settings.colorMode === 'gradient';
}
for (const key of ['autoOrder', 'edgeAware', 'transparent', 'foreground', 'background', 'highlight']) $(`#${key}`).addEventListener('input', event => { settings[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; activeLook = null; syncControls(); scheduleRender(); });
$('#characters').addEventListener('input', event => {
  if (!event.target.value.trim()) { event.target.setCustomValidity('Enter at least one visible character.'); event.target.reportValidity(); return; }
  event.target.setCustomValidity(''); settings.characters = normalizeSettings({ characters: event.target.value }).characters; activeLook = null; $('#charset').value = 'custom'; scheduleRender();
});
$('#charset').onchange = event => { if (CHARSETS[event.target.value]) { settings.characters = CHARSETS[event.target.value]; activeLook = null; syncControls(); scheduleRender(); } else $('#characters').focus(); };
$$('[data-color]').forEach(button => button.onclick = () => { settings.colorMode = button.dataset.color; activeLook = null; syncControls(); scheduleRender(); });
function setPanel(next) {
  panel = next;
  $$('[data-panel]').forEach(button => { const active = button.dataset.panel === next; button.classList.toggle('active', active); button.setAttribute('aria-selected', active); button.tabIndex = active ? 0 : -1; });
  $('#look-panel').hidden = next !== 'look'; $('#mask-panel').hidden = next !== 'mask'; document.body.classList.toggle('mask-editing', next === 'mask');
  if (next === 'mask') setView('result'); drawOverlay();
}
$$('[data-panel]').forEach(button => { button.onclick = () => setPanel(button.dataset.panel); button.onkeydown = event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const next = panel === 'look' ? 'mask' : 'look'; setPanel(next); $(`#${next}-tab`).focus(); } }; });
function setView(next) { view = next; $$('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === next); button.setAttribute('aria-pressed', button.dataset.view === next); }); drawPreview(); drawOverlay(); }
$$('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
function selectTool(next) { tool = next; $$('[data-tool]').forEach(button => { button.classList.toggle('active', button.dataset.tool === next); button.setAttribute('aria-pressed', button.dataset.tool === next); }); }
$$('[data-tool]').forEach(button => button.onclick = () => selectTool(button.dataset.tool));
$('#mask-mode').onchange = event => { settings.maskMode = event.target.value; scheduleRender(); };
$('#show-mask').onchange = drawOverlay;

function scheduleRender() { generation++; clearTimeout(scheduled); scheduled = setTimeout(render, 65); }
async function render() {
  if (!source || busy) return;
  busy = true; const current = generation, version = sourceVersion, started = performance.now(), config = { ...settings };
  document.body.classList.add('rendering'); $('#render-status').textContent = 'Rendering…';
  try {
    const next = await analyzeAsync(pixels, config);
    if (current !== generation || version !== sourceVersion) return;
    const refined = refineMask(mask, source.width, source.height, config.expansion, config.feather);
    const output = renderComposite(source, pixels, next, refined, config);
    analysis = next; rendered = output; drawPreview(); drawOverlay();
    $('#render-status').textContent = `Preview ready · ${Math.round(performance.now() - started)} ms`;
    $('#glyph-count').textContent = `${next.cells.length.toLocaleString()} characters`;
  } catch (error) { fail(error); $('#render-status').textContent = 'Render failed · adjust settings'; }
  finally { busy = false; document.body.classList.remove('rendering'); if (current !== generation) render(); }
}
function drawPreview() {
  if (!source) return;
  const ctx = preview.getContext('2d'); ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(previewOriginal || view === 'original' || !rendered ? source : rendered, 0, 0);
  if (view === 'split' && !previewOriginal) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, preview.width * split, preview.height); ctx.clip(); ctx.drawImage(source, 0, 0); ctx.restore(); }
  $('#split-line').hidden = view !== 'split' || previewOriginal; $('#split-line').style.left = `${split * 100}%`;
  $('#image-badge').textContent = previewOriginal || view === 'original' ? 'ORIGINAL / UNTOUCHED' : view === 'split' ? 'ORIGINAL / ASCII' : 'ASCII / LIVE PREVIEW';
}
function drawOverlay() {
  const ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!source || panel !== 'mask' || !$('#show-mask').checked || view !== 'result' || previewOriginal) return;
  const tint = new Uint8ClampedArray(mask.length * 4);
  for (let p = 0; p < mask.length; p++) { tint[p * 4] = 188; tint[p * 4 + 1] = 159; tint[p * 4 + 2] = 255; tint[p * 4 + 3] = mask[p] * 0.38; }
  ctx.putImageData(new ImageData(tint, source.width, source.height), 0, 0);
  if (pointer?.tool === 'rectangle') { ctx.strokeStyle = '#e4cfff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(pointer.start.x, pointer.start.y, pointer.last.x - pointer.start.x, pointer.last.y - pointer.start.y); }
}
function fit() { if (!source) return; const maxHeight = window.innerWidth < 700 ? Math.min(240, innerHeight * 0.28) : Math.max(280, innerHeight - 350); const width = Math.min(source.width, maxHeight * source.width / source.height); $('#canvas-wrap').style.width = `${width}px`; }
$('#fit').onclick = fit; window.addEventListener('resize', fit);
function position(event) { const rect = overlay.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1) * (overlay.width - 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) * (overlay.height - 1) }; }
overlay.addEventListener('pointerdown', event => {
  if (!source || event.button !== 0) return;
  if (view === 'split') { pointer = { tool: 'split' }; overlay.setPointerCapture(event.pointerId); split = position(event).x / overlay.width; drawPreview(); return; }
  if (panel !== 'mask' || view !== 'result') return;
  overlay.setPointerCapture(event.pointerId); const point = position(event);
  pointer = { tool, start: point, last: point, erase: tool === 'erase' || event.shiftKey };
  history.push(mask);
  if (tool === 'region') { selectRegion(pixels.data, mask, source.width, source.height, point.x, point.y, tolerance, pointer.erase); scheduleRender(); }
  else if (tool !== 'rectangle') paintStroke(mask, source.width, source.height, point, point, brushSize / 2, pointer.erase);
  syncControls(); drawOverlay();
});
overlay.addEventListener('pointermove', event => {
  if (!pointer) return; const point = position(event);
  if (pointer.tool === 'split') { split = point.x / overlay.width; drawPreview(); return; }
  if (['brush', 'erase'].includes(pointer.tool)) paintStroke(mask, source.width, source.height, pointer.last, point, brushSize / 2, pointer.erase);
  pointer.last = point; drawOverlay();
});
function endStroke(event) {
  if (!pointer) return;
  if (pointer.tool === 'rectangle') fillRectangle(mask, source.width, source.height, pointer.start, pointer.last, pointer.erase);
  const changed = pointer.tool !== 'split'; pointer = null;
  if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
  if (changed) { drawOverlay(); scheduleRender(); }
}
overlay.addEventListener('pointerup', endStroke); overlay.addEventListener('pointercancel', endStroke); overlay.addEventListener('lostpointercapture', endStroke);
function changeMask(action) { if (!mask) return; history.push(mask); action(); syncControls(); drawOverlay(); scheduleRender(); }
$('#invert-mask').onclick = () => changeMask(() => { mask = mask.map(value => 255 - value); });
$('#clear-mask').onclick = () => changeMask(() => mask.fill(0));
function undo() { if (!mask) return; mask = history.undo(mask); syncControls(); drawOverlay(); scheduleRender(); }
function redo() { if (!mask) return; mask = history.redo(mask); syncControls(); drawOverlay(); scheduleRender(); }
$('#undo-mask').onclick = undo; $('#redo-mask').onclick = redo;
window.addEventListener('keydown', event => {
  if (event.target.closest('input,select,textarea,dialog') || $('dialog[open]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (event.code === 'Space') { event.preventDefault(); previewOriginal = true; drawPreview(); drawOverlay(); }
  const keyTool = { b: 'brush', e: 'erase', w: 'region', r: 'rectangle' }[event.key.toLowerCase()];
  if (keyTool && !event.ctrlKey && !event.metaKey) { setPanel('mask'); selectTool(keyTool); }
});
window.addEventListener('keyup', event => { if (event.code === 'Space') { previewOriginal = false; drawPreview(); drawOverlay(); } });
window.addEventListener('blur', () => { previewOriginal = false; drawPreview(); drawOverlay(); });

async function decodeImage(blob) {
  if (blob.size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.');
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width * bitmap.height > 12000000 || Math.max(bitmap.width, bitmap.height) > 6000) { bitmap.close(); throw new Error('Choose an image up to 12 megapixels and 6,000 pixels per side.'); }
  return bitmap;
}
async function loadImage(blob, filename) {
  const request = ++loadingGeneration;
  const bitmap = await decodeImage(blob);
  if (request !== loadingGeneration) { bitmap.close(); return; }
  original = canvas(bitmap.width, bitmap.height); original.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
  const scale = Math.min(1, 1400 / Math.max(original.width, original.height));
  source = canvas(Math.round(original.width * scale), Math.round(original.height * scale)); source.getContext('2d').drawImage(original, 0, 0, source.width, source.height);
  pixels = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, source.width, source.height);
  mask = new Uint8ClampedArray(source.width * source.height); history.clear(); pointer = null; rendered = null; analysis = null; sourceVersion++;
  preview.width = overlay.width = source.width; preview.height = overlay.height = source.height;
  name = filename.replace(/\.[^.]+$/, ''); $('#filename').textContent = $('#image-title').textContent = name;
  $('#dimensions').textContent = `${original.width} × ${original.height} px`; syncControls(); fit(); drawPreview(); drawOverlay(); scheduleRender();
}
async function loadFile(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/bmp'].includes(file.type)) throw new Error('Please choose a PNG, JPEG, WebP, AVIF, or BMP image.');
  await loadImage(file, file.name);
}
$('#upload').onclick = () => $('#file-input').click();
$('#file-input').onchange = async event => { try { await loadFile(event.target.files[0]); } catch (error) { fail(error); } event.target.value = ''; };
let dragDepth = 0;
window.addEventListener('dragenter', event => { if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-zone').hidden = false; } });
window.addEventListener('dragover', event => { event.preventDefault(); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop-zone').hidden = true; } });
window.addEventListener('drop', async event => { event.preventDefault(); dragDepth = 0; $('#drop-zone').hidden = true; try { await loadFile(event.dataTransfer.files[0]); } catch (error) { fail(error); } });
async function demo() {
  const response = await fetch(new URL('../assets/alpine.svg', import.meta.url));
  const blob = await response.blob(), url = URL.createObjectURL(blob);
  try {
    // SVG decoding via Image works consistently across browsers.
    const image = new Image(); image.src = url; await image.decode();
    const surface = canvas(image.naturalWidth, image.naturalHeight); surface.getContext('2d').drawImage(image, 0, 0);
    await loadImage(await toBlob(surface), 'Alpine study');
  } finally { URL.revokeObjectURL(url); }
}
$('#demo').onclick = () => demo().catch(fail);
$('#reset').onclick = () => { settings = { ...DEFAULTS }; activeLook = 'field'; syncControls(); scheduleRender(); toast('Appearance reset. Your mask is unchanged.'); };
$('#save-preset').onclick = () => download(new Blob([JSON.stringify({ version: 1, settings }, null, 2)], { type: 'application/json' }), 'flower-look.json');
$('#load-preset').onclick = () => $('#preset-input').click();
$('#preset-input').onchange = async event => { try { const file = event.target.files[0]; if (!file) return; if (file.size > 64000) throw new Error('Look files must be smaller than 64 KB.'); settings = parsePreset(await file.text()); activeLook = null; syncControls(); scheduleRender(); toast('Look loaded.'); } catch (error) { fail(error); } finally { event.target.value = ''; } };
$('#import-mask').onclick = () => $('#mask-input').click();
$('#mask-input').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file || !source) return;
    const version = sourceVersion, bitmap = await decodeImage(file);
    if (version !== sourceVersion) { bitmap.close(); return; }
    const surface = canvas(source.width, source.height); surface.getContext('2d').drawImage(bitmap, 0, 0, surface.width, surface.height); bitmap.close();
    const data = surface.getContext('2d').getImageData(0, 0, surface.width, surface.height).data;
    changeMask(() => { for (let p = 0; p < mask.length; p++) mask[p] = ((data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3) * data[p * 4 + 3] / 255; });
    toast('Mask imported and fitted to your image.');
  } catch (error) { fail(error); } finally { event.target.value = ''; }
};
$('#download-mask').onclick = async () => { try { if (!source) return; const fullMask = resizeMask(mask, source.width, source.height, original.width, original.height); download(await toBlob(maskCanvas(fullMask, original.width, original.height)), `${safeName()}-mask.png`); } catch (error) { fail(error); } };
async function checkAI() {
  if (document.documentElement.dataset.runtime === 'static' || !['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
    $('#ai-status').textContent = 'Automatic selection runs in the local edition. Use the manual tools here, or install Flower locally.';
    $('#auto-mask').disabled = true;
    const link = document.createElement('a'); link.href = 'https://github.com/philppplik/flower/blob/main/docs/INSTALLATION.md'; link.textContent = 'Install the local edition ↗'; link.className = 'install-link'; $('#ai-status').after(link); return;
  }
  try { const response = await fetch('/api/status'); const status = await response.json(); $('#ai-status').textContent = status.aiReady ? status.modelCached ? 'Local AI ready. Model cached for offline selection.' : 'Local AI ready. First use downloads the model (~176 MB).' : 'Optional setup: install requirements-ai.txt, then restart. See README.md.'; $('#auto-mask').disabled = !status.aiReady; }
  catch { $('#ai-status').textContent = 'Start the local server with node server.mjs to enable AI.'; $('#auto-mask').disabled = true; }
}
$('#auto-mask').onclick = async () => {
  if (!source) return;
  const button = $('#auto-mask'), version = sourceVersion; button.disabled = true; button.textContent = 'Selecting subject…';
  $('#ai-status').textContent = 'Processing locally. First use may take several minutes while the model downloads.';
  try {
    const response = await fetch('/api/segment', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: await toBlob(source), signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error((await response.json()).error || 'Local segmentation failed.');
    const bitmap = await createImageBitmap(await response.blob());
    if (version !== sourceVersion) { bitmap.close(); return; }
    const surface = canvas(source.width, source.height); surface.getContext('2d').drawImage(bitmap, 0, 0, surface.width, surface.height); bitmap.close();
    const data = surface.getContext('2d').getImageData(0, 0, surface.width, surface.height).data;
    changeMask(() => { mask = Uint8ClampedArray.from({ length: mask.length }, (_, i) => data[i * 4]); });
    $('#ai-status').textContent = 'Subject selected. Refine the result with Brush or Erase.';
  } catch (error) { fail(error); $('#ai-status').textContent = error.message; }
  finally { button.disabled = false; button.textContent = '✧ Select subject'; }
};

function safeName() { return name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'image'; }
$('#help').onclick = () => $('#help-dialog').showModal();
function exportInfo() { if (!original) return; const scale = +$('#export-scale').value; $('#export-info').textContent = `${Math.round(original.width * scale)} × ${Math.round(original.height * scale)} px · Up to 24 megapixels. ${$('#format').value === 'svg' ? 'SVG uses vector glow; film grain is raster-only.' : ''}`; }
$('#export-open').onclick = () => { if (!original) return; exportInfo(); $('#export-dialog').showModal(); };
$('#export-scale').onchange = exportInfo; $('#format').onchange = exportInfo;
$('#export-confirm').onclick = async () => {
  if (!source) return;
  const button = $('#export-confirm'); button.disabled = true; button.textContent = 'Rendering full resolution…';
  const config = { ...settings }, selectedFormat = $('#format').value, scale = +$('#export-scale').value;
  const originalSnapshot = original, maskSnapshot = mask.slice(), pw = source.width, ph = source.height, exportName = safeName();
  try {
    const width = Math.max(1, Math.round(originalSnapshot.width * scale)), height = Math.max(1, Math.round(originalSnapshot.height * scale));
    if (width * height > 24000000 || Math.max(width, height) > 10000) throw new Error('Export exceeds 24 megapixels or 10,000 pixels per side. Choose a smaller output scale.');
    await new Promise(resolve => setTimeout(resolve, 30));
    const surface = canvas(width, height); surface.getContext('2d').drawImage(originalSnapshot, 0, 0, width, height);
    const fullPixels = surface.getContext('2d').getImageData(0, 0, width, height);
    const renderScale = width / pw;
    const result = await analyzeAsync(fullPixels, config, renderScale);
    const refined = refineMask(maskSnapshot, pw, ph, config.expansion, config.feather);
    const fullMask = resizeMask(refined, pw, ph, width, height);
    if (selectedFormat === 'txt') download(new Blob([result.lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${exportName}-ascii.txt`);
    else if (selectedFormat === 'svg') {
      const effect = fullMask.map(v => Math.round(255 * config.replacement * (config.maskMode === 'none' ? 1 : config.maskMode === 'apply' ? v / 255 : 1 - v / 255)));
      const originalMask = effect.map(v => 255 - v);
      const svg = createSvg(result, { ...config, glowRadius: config.glowRadius * renderScale }, surface.toDataURL(), maskCanvas(effect, width, height).toDataURL(), maskCanvas(originalMask, width, height).toDataURL());
      download(new Blob([svg], { type: 'image/svg+xml' }), `${exportName}-ascii.svg`);
    } else {
      let output = renderComposite(surface, fullPixels, result, fullMask, config, renderScale);
      if (selectedFormat === 'jpeg') { const flattened = canvas(width, height), ctx = flattened.getContext('2d'); ctx.fillStyle = config.background; ctx.fillRect(0, 0, width, height); ctx.drawImage(output, 0, 0); output = flattened; }
      const mime = `image/${selectedFormat}`, blob = await toBlob(output, mime);
      if (blob.type !== mime) throw new Error(`This browser does not support ${selectedFormat.toUpperCase()} export. Use PNG instead.`);
      download(blob, `${exportName}-ascii.${selectedFormat === 'jpeg' ? 'jpg' : selectedFormat}`);
    }
    $('#export-dialog').close(); toast('Export ready. Your download has started.');
  } catch (error) { fail(error); }
  finally { button.disabled = false; button.textContent = 'Download image ↗'; }
};
const initialLook = new URLSearchParams(location.search).get('look');
if (Object.hasOwn(PRESETS, initialLook)) { settings = { ...PRESETS[initialLook].settings }; activeLook = initialLook; }
const onboarding = setupOnboarding({ setPanel, upload: () => $('#file-input').click() });
syncControls(); selectTool('brush'); checkAI(); demo().then(() => onboarding.welcome()).catch(fail);
