import test from 'node:test';
import assert from 'node:assert/strict';

import { persistenceOpacity } from '../src/ui/waveform-renderer.js';

test('persistence trail grows toward the newest retained frame and remains subtle', () => {
  const values = Array.from({ length: 8 }, (_, index) => persistenceOpacity(index, 8));
  assert.ok(values[0] >= 0.05);
  assert.ok(values.at(-1) <= 0.28);
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] > values[index - 1]);
  }
  assert.equal(persistenceOpacity(0, 0), 0);
});
