import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_KEY, TOUR_STEPS, hasSeenWelcome, rememberWelcome, placePopover } from '../src/core/onboarding.js';

test('welcome persistence records only completion, not user image data', () => {
  const saved = new Map(), storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  assert.equal(hasSeenWelcome(storage), false); rememberWelcome(storage); assert.equal(hasSeenWelcome(storage), true); assert.deepEqual([...saved], [[TOUR_KEY, 'done']]);
});
test('blocked or unavailable storage never prevents creating', () => {
  assert.equal(hasSeenWelcome(null), false); assert.doesNotThrow(() => rememberWelcome(null));
  const storage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  assert.equal(hasSeenWelcome(storage), false); assert.doesNotThrow(() => rememberWelcome(storage));
});
test('tour is a finite create, protect, compare, export workflow', () => {
  assert.equal(TOUR_STEPS.length, 5); assert.equal(TOUR_STEPS[0].target, '#upload'); assert.equal(TOUR_STEPS.at(-1).target, '#export-open'); assert.ok(TOUR_STEPS.some(step => step.panel === 'mask'));
});
test('popover sits below target when there is room', () => {
  assert.deepEqual(placePopover({ left: 100, top: 100, bottom: 140 }, { width: 1200, height: 900 }), { left: 100, top: 154, width: 340 });
});
test('popover flips above a target at the bottom of the viewport', () => {
  const result = placePopover({ left: 900, top: 750, bottom: 790 }, { width: 1200, height: 800 }); assert.equal(result.top, 456); assert.ok(result.left + result.width <= 1184);
});
test('narrow mobile popover stays inside the viewport', () => {
  const result = placePopover({ left: 350, top: 5, bottom: 40 }, { width: 360, height: 640 }); assert.equal(result.width, 328); assert.equal(result.left, 16); assert.ok(result.top >= 16); assert.ok(result.top + 280 <= 624);
});
