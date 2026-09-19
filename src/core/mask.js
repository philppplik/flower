import { clamp } from './settings.js';
export function paintStroke(mask, width, height, from, to, radius, erase = false) {
  const dx = to.x - from.x, dy = to.y - from.y, lengthSquared = dx * dx + dy * dy;
  const x0 = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius)), x1 = Math.min(width - 1, Math.ceil(Math.max(from.x, to.x) + radius));
  const y0 = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius)), y1 = Math.min(height - 1, Math.ceil(Math.max(from.y, to.y) + radius));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = lengthSquared ? clamp(((x - from.x) * dx + (y - from.y) * dy) / lengthSquared) : 0;
    if ((x - from.x - t * dx) ** 2 + (y - from.y - t * dy) ** 2 <= radius ** 2) mask[y * width + x] = erase ? 0 : 255;
  }
}
export function fillRectangle(mask, width, height, from, to, erase = false) {
  const x0 = clamp(Math.floor(Math.min(from.x, to.x)), 0, width - 1), x1 = clamp(Math.ceil(Math.max(from.x, to.x)), 0, width - 1);
  const y0 = clamp(Math.floor(Math.min(from.y, to.y)), 0, height - 1), y1 = clamp(Math.ceil(Math.max(from.y, to.y)), 0, height - 1);
  for (let y = y0; y <= y1; y++) mask.fill(erase ? 0 : 255, y * width + x0, y * width + x1 + 1);
}
export function selectRegion(data, mask, width, height, x, y, tolerance, subtract = false) {
  const start = clamp(Math.floor(y), 0, height - 1) * width + clamp(Math.floor(x), 0, width - 1), base = start * 4;
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 1; queue[0] = start; visited[start] = 1;
  const limit = 3 * tolerance ** 2;
  while (head < tail) {
    const p = queue[head++], i = p * 4;
    if ((data[i] - data[base]) ** 2 + (data[i + 1] - data[base + 1]) ** 2 + (data[i + 2] - data[base + 2]) ** 2 > limit || Math.abs(data[i + 3] - data[base + 3]) > tolerance) continue;
    mask[p] = subtract ? 0 : 255;
    const add = n => { if (!visited[n]) { visited[n] = 1; queue[tail++] = n; } };
    if (p % width > 0) add(p - 1); if (p % width < width - 1) add(p + 1);
    if (p >= width) add(p - width); if (p < width * (height - 1)) add(p + width);
  }
}
function windowPass(input, width, height, radius, horizontal, kind) {
  const result = new Uint8ClampedArray(input.length), outer = horizontal ? height : width, inner = horizontal ? width : height;
  for (let line = 0; line < outer; line++) {
    const index = p => horizontal ? line * width + p : p * width + line;
    if (kind === 'blur') {
      let sum = 0;
      for (let j = -radius; j <= radius; j++) sum += input[index(clamp(j, 0, inner - 1))];
      for (let p = 0; p < inner; p++) {
        result[index(p)] = sum / (2 * radius + 1);
        sum += input[index(clamp(p + radius + 1, 0, inner - 1))] - input[index(clamp(p - radius, 0, inner - 1))];
      }
    } else {
      // Monotonic queue: dilation/erosion are O(pixels), independent of radius.
      const deque = new Int32Array(inner + 2 * radius); let head = 0, tail = 0;
      for (let p = -radius; p < inner + radius; p++) {
        const value = input[index(clamp(p, 0, inner - 1))];
        while (tail > head && (kind === 'max' ? input[index(clamp(deque[tail - 1], 0, inner - 1))] <= value : input[index(clamp(deque[tail - 1], 0, inner - 1))] >= value)) tail--;
        deque[tail++] = p;
        while (tail > head && deque[head] < p - 2 * radius) head++;
        if (p >= radius) result[index(p - radius)] = input[index(clamp(deque[head], 0, inner - 1))];
      }
    }
  }
  return result;
}
export function refineMask(mask, width, height, expansion = 0, feather = 0) {
  let output = mask.slice();
  const radius = Math.round(Math.abs(expansion));
  if (radius) output = windowPass(windowPass(output, width, height, radius, true, expansion > 0 ? 'max' : 'min'), width, height, radius, false, expansion > 0 ? 'max' : 'min');
  const blur = Math.round(feather);
  if (blur) for (let i = 0; i < 2; i++) output = windowPass(windowPass(output, width, height, blur, true, 'blur'), width, height, blur, false, 'blur');
  return output;
}
export class MaskHistory {
  constructor(maxBytes = 48 * 1024 * 1024) { this.maxBytes = maxBytes; this.past = []; this.future = []; }
  push(mask) { this.past.push(mask.slice()); this.future = []; while (this.past.length > 1 && this.past.length * mask.length > this.maxBytes) this.past.shift(); }
  undo(current) { if (!this.past.length) return current; this.future.push(current.slice()); return this.past.pop(); }
  redo(current) { if (!this.future.length) return current; this.past.push(current.slice()); return this.future.pop(); }
  clear() { this.past = []; this.future = []; }
}
