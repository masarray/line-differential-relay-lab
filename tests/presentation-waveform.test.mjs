import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAVEFORM_DISPLAY_MODES as CONTROL_MODES,
  normalizeWaveformDisplayMode as normalizeControlMode
} from '../src/ui/presentation-waveform.js';
import {
  WAVEFORM_DISPLAY_MODES as RENDER_MODES,
  normalizeWaveformDisplayMode as normalizeRenderMode,
  persistenceOpacity
} from '../src/ui/waveform-renderer.js';

test('presentation and renderer use the same waveform display modes', () => {
  assert.deepEqual(CONTROL_MODES, RENDER_MODES);
  assert.equal(normalizeControlMode('persist'), 'persist');
  assert.equal(normalizeRenderMode('freeze'), 'freeze');
  assert.equal(normalizeControlMode('unknown'), 'live');
  assert.equal(normalizeRenderMode(null), 'live');
});

test('persistence trail grows toward the newest retained frame and remains subtle', () => {
  const values = Array.from({ length: 8 }, (_, index) => persistenceOpacity(index, 8));
  assert.ok(values[0] >= 0.05);
  assert.ok(values.at(-1) <= 0.28);
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] > values[index - 1]);
  }
  assert.equal(persistenceOpacity(0, 0), 0);
});
