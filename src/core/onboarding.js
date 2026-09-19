export const TOUR_KEY = 'flower:welcome:v1';
export const TOUR_STEPS = Object.freeze([
  { target: '#upload', title: 'Start with something you love.', text: 'Open a photo, or keep exploring with our sample. Your image stays on your device.', panel: 'look' },
  { target: '#presets', title: 'Find your kind of character.', text: 'Pick a look for an instant starting point. Use character size, color and light to make it yours.', panel: 'look' },
  { target: '#mask-tab', title: 'Keep the good bits untouched.', text: 'Open Protect and paint over your subject. Flower keeps those original pixels while transforming everything around them.', panel: 'mask' },
  { target: '.view-switch', title: 'See what changed.', text: 'Compare reveals your original alongside the result. Drag the divider, or hold Space for a quick look back.', panel: 'look' },
  { target: '#export-open', title: 'Made it yours? Take it with you.', text: 'Export a lossless PNG, a compact image, editable SVG text, or a plain-text character grid. No account needed.', panel: 'look' },
]);
export function hasSeenWelcome(storage) { try { return storage.getItem(TOUR_KEY) === 'done'; } catch { return false; } }
export function rememberWelcome(storage) { try { storage.setItem(TOUR_KEY, 'done'); } catch { /* Storage is optional in private browsing. */ } }
export function placePopover(target, viewport, card = { width: 340, height: 280 }) {
  const margin = 16, gap = 14, width = Math.max(0, Math.min(card.width, viewport.width - 2 * margin));
  const left = Math.max(margin, Math.min(target.left, viewport.width - width - margin));
  let top = target.bottom + gap;
  if (top + card.height > viewport.height - margin) top = target.top - card.height - gap;
  if (top < margin) top = Math.max(margin, viewport.height - card.height - margin);
  return { left, top, width };
}
