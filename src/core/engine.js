import { clamp } from './settings.js';
export const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
export function tone(value, settings) { return Math.pow(clamp((value - 0.5) * settings.contrast + 0.5 + settings.brightness), 1 / settings.gamma); }
export function hexRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
export function colorAt(rgb, brightness, settings) {
  if (settings.colorMode === 'mono') return hexRgb(settings.foreground);
  if (settings.colorMode === 'gradient') {
    const low = hexRgb(settings.foreground), high = hexRgb(settings.highlight);
    return low.map((v, i) => Math.round(v + (high[i] - v) * brightness));
  }
  const gray = luminance(...rgb) * 255;
  const saturated = rgb.map(v => Math.round(clamp(gray + (v - gray) * settings.saturation, 0, 255)));
  return settings.colorMode === 'palette' ? saturated.map(v => Math.round(v / 85) * 85) : saturated;
}
export function randomAt(x, y) { let n = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
/** Independent image analysis: no DOM, model, or canvas dependencies. */
export function analyzeImage(data, width, height, settings, orderedCharacters = [...settings.characters], scale = 1) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw new Error('Invalid image dimensions.');
  if (!Number.isFinite(scale) || scale <= 0 || !orderedCharacters.length) throw new Error('Invalid render parameters.');
  const stepX = Math.max(2, settings.size * 0.66 * settings.spacingX * scale);
  const stepY = Math.max(2, settings.size * settings.spacingY * scale);
  const cols = Math.ceil(width / stepX), rows = Math.ceil(height / stepY);
  if (cols * rows > 650000) throw new Error('Too many characters. Increase character size or spacing.');
  const cells = [], lines = [];
  const lumAt = (x, y) => { const i = (clamp(Math.floor(y), 0, height - 1) * width + clamp(Math.floor(x), 0, width - 1)) * 4; return luminance(data[i], data[i + 1], data[i + 2]) * data[i + 3] / 255; };
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const left = Math.floor(col * stepX), top = Math.floor(row * stepY), right = Math.min(width, Math.ceil((col + 1) * stepX)), bottom = Math.min(height, Math.ceil((row + 1) * stepY));
      let r = 0, g = 0, b = 0, alpha = 0, count = 0;
      // Bounded sampling keeps even full-resolution exports responsive.
      const stride = Math.max(1, Math.floor(Math.min(stepX, stepY) / 5));
      for (let y = top; y < bottom; y += stride) for (let x = left; x < right; x += stride) {
        const i = (y * width + x) * 4, a = data[i + 3] / 255;
        r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a; alpha += a; count++;
      }
      const rgb = alpha ? [r / alpha, g / alpha, b / alpha] : [0, 0, 0];
      const brightness = tone(luminance(...rgb), settings);
      // Dark ink on light paper reverses coverage, not the source colors.
      const darkInk = settings.colorMode === 'mono' && luminance(...hexRgb(settings.foreground)) < luminance(...hexRgb(settings.background));
      const coverage = darkInk ? 1 - brightness : brightness;
      let char = orderedCharacters[Math.round(coverage * (orderedCharacters.length - 1))];
      const x = (left + right) / 2, y = (top + bottom) / 2;
      const gx = lumAt(x + stepX / 2, y) - lumAt(x - stepX / 2, y), gy = lumAt(x, y + stepY / 2) - lumAt(x, y - stepY / 2);
      if (settings.edgeAware && Math.hypot(gx, gy) > 1 - settings.edgeStrength * 0.95) {
        const candidates = Math.abs(gx) > Math.abs(gy) * 2 ? ['|', 'I', '1'] : Math.abs(gy) > Math.abs(gx) * 2 ? ['-', '=', '_'] : gx * gy > 0 ? ['/', 'x', 'X'] : ['\\', 'x', 'X'];
        char = candidates.find(c => orderedCharacters.includes(c)) ?? char;
      }
      if (randomAt(col, row) > settings.density || alpha === 0) char = ' ';
      line += char;
      if (char !== ' ') cells.push({ x, y, char, color: colorAt(rgb, brightness, settings), brightness, alpha: alpha / count });
    }
    lines.push(line);
  }
  return { cells, lines, cols, rows, fontSize: settings.size * scale, width, height };
}
/** Linear mix in premultiplied alpha; selected original pixels are copied exactly. */
export function compositePixels(source, effect, mask, settings) {
  if (source.length !== effect.length || source.length !== mask.length * 4) throw new Error('Composite dimensions do not match.');
  const out = new Uint8ClampedArray(source.length);
  for (let p = 0; p < mask.length; p++) {
    const selected = mask[p] / 255;
    const amount = settings.replacement * (settings.maskMode === 'none' ? 1 : settings.maskMode === 'apply' ? selected : 1 - selected);
    const i = p * 4;
    if (amount === 0) { out[i] = source[i]; out[i + 1] = source[i + 1]; out[i + 2] = source[i + 2]; out[i + 3] = source[i + 3]; continue; }
    const a = source[i + 3] / 255 * (1 - amount), b = effect[i + 3] / 255 * amount, alpha = a + b;
    for (let c = 0; c < 3; c++) out[i + c] = alpha ? (source[i + c] * a + effect[i + c] * b) / alpha : 0;
    out[i + 3] = alpha * 255;
  }
  return out;
}
