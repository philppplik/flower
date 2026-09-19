import { PRESETS } from './core/settings.js';
import { analyzeImage } from './core/engine.js';
import { canvas, orderCharacters, renderEffect } from './render.js';

const compare = document.querySelector('#bloom-compare');
function updateComparison() {
  document.querySelector('.specimen-image').style.setProperty('--split', `${compare.value}%`);
  document.querySelector('#bloom-amount').textContent = `${compare.value}% original · ${100 - compare.value}% ASCII`;
}
compare.addEventListener('input', updateComparison); updateComparison();
async function paintSpecimens() {
  const image = document.querySelector('#bloom-original'); await image.decode();
  const targets = [{ target: document.querySelector('#bloom-ascii'), look: 'paper' }, ...[...document.querySelectorAll('[data-look]')].map(card => ({ target: card.querySelector('canvas'), look: card.dataset.look }))];
  for (const { target, look } of targets) {
    const source = canvas(target.width, target.height), ctx = source.getContext('2d'); ctx.drawImage(image, 0, 0, source.width, source.height);
    const settings = { ...PRESETS[look].settings, size: target.width > 400 ? 9 : 6, spacingY: 1.1, vignette: 0, glow: 0, originalOpacity: 0, edgeAware: false };
    if (target.id === 'bloom-ascii') { settings.foreground = '#67492f'; settings.background = '#efe2cc'; }
    const pixels = ctx.getImageData(0, 0, source.width, source.height);
    const result = analyzeImage(pixels.data, source.width, source.height, settings, orderCharacters(settings.characters, true));
    target.getContext('2d').putImageData(renderEffect(source, result, settings), 0, 0);
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  document.body.classList.add('specimens-ready');
}
paintSpecimens().catch(() => { document.querySelector('.specimen-controls').hidden = true; document.querySelector('.specimen-divider').hidden = true; });
