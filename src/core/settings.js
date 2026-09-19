export const CHARSETS = Object.freeze({ classic: ' .:-=+*#%@', cyber: ' .01xX+#S8@', minimal: ' .:-+=', matrix: ' 01', letters: ' .ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
export const DEFAULTS = Object.freeze({
  characters: CHARSETS.classic, autoOrder: true, size: 11, spacingX: 1, spacingY: 1.15,
  rotation: 0, density: 1, contrast: 1.2, brightness: 0, gamma: 1,
  edgeAware: true, edgeStrength: 0.25, colorMode: 'original', foreground: '#c8f5a4',
  background: '#101315', highlight: '#ffe5b5', saturation: 1.15, glow: 0.2,
  glowRadius: 4, glowThreshold: 0.55, grain: 0, scanlines: 0, vignette: 0.15,
  replacement: 1, originalOpacity: 0.08, asciiOpacity: 1, transparent: false,
  maskMode: 'protect', feather: 0, expansion: 0,
});
export const RANGES = Object.freeze({ size: [3, 80], spacingX: [0.6, 2], spacingY: [0.6, 2], rotation: [-90, 90], density: [0.1, 1], contrast: [0.2, 3], brightness: [-0.5, 0.5], gamma: [0.2, 3], edgeStrength: [0, 1], saturation: [0, 2], glow: [0, 1], glowRadius: [0, 20], glowThreshold: [0, 1], grain: [0, 0.3], scanlines: [0, 0.8], vignette: [0, 1], replacement: [0, 1], originalOpacity: [0, 1], asciiOpacity: [0, 1], feather: [0, 20], expansion: [-20, 20] });
export const PRESETS = Object.freeze({
  field: { label: 'Field notes', subtitle: 'TRUE COLOR', sample: '#+x', settings: { ...DEFAULTS } },
  terminal: { label: 'Terminal', subtitle: 'AFTER HOURS', sample: '01_', settings: { ...DEFAULTS, characters: CHARSETS.matrix, colorMode: 'mono', foreground: '#b7f394', background: '#0c1510', glow: 0.5, size: 12, scanlines: 0.2, originalOpacity: 0 } },
  paper: { label: 'On paper', subtitle: 'INK & SPACE', sample: '@&.', settings: { ...DEFAULTS, colorMode: 'mono', foreground: '#302d28', background: '#e8e1d1', glow: 0, vignette: 0, originalOpacity: 0, size: 10 } },
  dusk: { label: 'Dusk', subtitle: 'WARM SIGNAL', sample: '*:;', settings: { ...DEFAULTS, colorMode: 'gradient', foreground: '#bb7466', background: '#211b2e', highlight: '#ffd8a3', glow: 0.45, size: 12, originalOpacity: 0 } },
});
export function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
export function normalizeSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A look must contain a settings object.');
  const result = { ...DEFAULTS };
  for (const [key, [min, max]] of Object.entries(RANGES)) if (typeof input[key] === 'number' && Number.isFinite(input[key])) result[key] = clamp(input[key], min, max);
  for (const key of ['autoOrder', 'edgeAware', 'transparent']) if (typeof input[key] === 'boolean') result[key] = input[key];
  for (const key of ['foreground', 'background', 'highlight']) if (/^#[\da-f]{6}$/i.test(input[key])) result[key] = input[key];
  if (['original', 'mono', 'gradient', 'palette'].includes(input.colorMode)) result.colorMode = input.colorMode;
  if (['protect', 'apply', 'none'].includes(input.maskMode)) result.maskMode = input.maskMode;
  if (typeof input.characters === 'string') {
    const chars = [...new Set([...input.characters.replace(/[\x00-\x1f\x7f]/g, '')])].slice(0, 64).join('');
    if (chars.trim()) result.characters = chars;
  }
  return result;
}
export function parsePreset(text) {
  const parsed = JSON.parse(text);
  if (parsed?.version !== 1 || !parsed.settings) throw new Error('This is not a compatible Flower look.');
  return normalizeSettings(parsed.settings);
}
