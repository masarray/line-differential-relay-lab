import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateLag, normalizedCorrelation, shiftSeries } from '../src/engine/math.js';

function sine(length, cycles = 3) {
  return Float64Array.from({ length }, (_, index) => Math.sin((index / length) * Math.PI * 2 * cycles));
}

test('shiftSeries advances a delayed waveform', () => {
  const original = sine(240);
  const delayed = shiftSeries(original, -7);
  const restored = shiftSeries(delayed, 7);
  assert.ok(normalizedCorrelation(original, restored, 20, 210) > 0.999);
});

test('estimateLag finds the bounded correction', () => {
  const reference = sine(320, 4);
  const candidate = shiftSeries(reference, -11);
  const result = estimateLag(reference, candidate, 20, 30);
  assert.equal(result.lagSamples, 11);
  assert.ok(result.peakScore > 0.99);
});
