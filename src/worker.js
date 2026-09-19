import { analyzeImage } from './core/engine.js';
self.onmessage = ({ data: { id, pixels, width, height, settings, characters, scale } }) => {
  try { self.postMessage({ id, result: analyzeImage(pixels, width, height, settings, characters, scale) }); }
  catch (error) { self.postMessage({ id, error: error.message }); }
};
