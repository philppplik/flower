import { compositePixels, randomAt } from './core/engine.js';
export function canvas(width, height) { const element = document.createElement('canvas'); element.width = width; element.height = height; return element; }
const densityCache = new Map();
export function orderCharacters(characters, autoOrder) {
  const unique = [...new Set([...characters])];
  if (!autoOrder) return unique;
  if (densityCache.has(characters)) return densityCache.get(characters);
  const surface = canvas(40, 48), ctx = surface.getContext('2d', { willReadFrequently: true });
  ctx.font = '36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const measured = unique.map(char => {
    ctx.clearRect(0, 0, 40, 48); ctx.fillText(char, 20, 24);
    const pixels = ctx.getImageData(0, 0, 40, 48).data;
    let ink = 0; for (let i = 3; i < pixels.length; i += 4) ink += pixels[i];
    return { char, ink };
  });
  const result = measured.sort((a, b) => a.ink - b.ink).map(item => item.char);
  densityCache.set(characters, result); return result;
}
export function renderEffect(source, analysis, settings, scale = 1) {
  const { width, height } = source, output = canvas(width, height), ctx = output.getContext('2d', { willReadFrequently: true });
  if (!settings.transparent) { ctx.fillStyle = settings.background; ctx.fillRect(0, 0, width, height); }
  if (settings.originalOpacity) { ctx.globalAlpha = settings.originalOpacity; ctx.drawImage(source, 0, 0); ctx.globalAlpha = 1; }
  ctx.font = `${analysis.fontSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const draw = (cell, glowOnly) => {
    const color = `rgb(${cell.color.join(',')})`;
    ctx.fillStyle = color; ctx.globalAlpha = cell.alpha * settings.asciiOpacity * (glowOnly ? settings.glow : 1);
    ctx.shadowColor = glowOnly ? color : 'transparent'; ctx.shadowBlur = glowOnly ? settings.glowRadius * scale : 0;
    if (settings.rotation) { ctx.save(); ctx.translate(cell.x, cell.y); ctx.rotate(settings.rotation * Math.PI / 180); ctx.fillText(cell.char, 0, 0); ctx.restore(); }
    else ctx.fillText(cell.char, cell.x, cell.y);
  };
  if (settings.glow) for (const cell of analysis.cells) if (cell.brightness >= settings.glowThreshold) draw(cell, true);
  for (const cell of analysis.cells) draw(cell, false);
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (settings.scanlines) {
    ctx.fillStyle = `rgba(0,0,0,${settings.scanlines})`;
    for (let y = 0; y < height; y += 4 * scale) ctx.fillRect(0, y, width, Math.max(1, scale));
  }
  if (settings.vignette) {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.hypot(width, height) / 2);
    gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, `rgba(0,0,0,${settings.vignette})`); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
  const result = ctx.getImageData(0, 0, width, height);
  if (settings.grain) for (let p = 0; p < width * height; p++) { const noise = (randomAt(p % width, Math.floor(p / width)) - 0.5) * 255 * settings.grain; for (let c = 0; c < 3; c++) result.data[p * 4 + c] += noise; }
  return result;
}
export function renderComposite(source, sourcePixels, analysis, mask, settings, scale = 1) {
  const effect = renderEffect(source, analysis, settings, scale);
  const pixels = compositePixels(sourcePixels.data, effect.data, mask, settings);
  const result = canvas(source.width, source.height);
  result.getContext('2d').putImageData(new ImageData(pixels, source.width, source.height), 0, 0);
  return result;
}
export function maskCanvas(mask, width, height, asAlpha = false) {
  const result = canvas(width, height), pixels = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < mask.length; p++) { pixels[p * 4] = pixels[p * 4 + 1] = pixels[p * 4 + 2] = asAlpha ? 255 : mask[p]; pixels[p * 4 + 3] = asAlpha ? mask[p] : 255; }
  result.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0); return result;
}
export function resizeMask(mask, width, height, newWidth, newHeight) {
  const target = canvas(newWidth, newHeight), ctx = target.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false; ctx.drawImage(maskCanvas(mask, width, height), 0, 0, newWidth, newHeight);
  const pixels = ctx.getImageData(0, 0, newWidth, newHeight).data;
  return Uint8ClampedArray.from({ length: newWidth * newHeight }, (_, i) => pixels[i * 4]);
}
export function toBlob(surface, type = 'image/png', quality = 0.94) {
  return new Promise((resolve, reject) => surface.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')), type, quality));
}
export function download(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
