import test from 'node:test';
import assert from 'node:assert/strict';

import { blendDisplayFrame, blendDisplaySeries, frameScale } from '../src/ui/waveform-renderer.js';

test('display blending eases finite waveform samples without inventing missing data', () => {
  const blended = blendDisplaySeries([0, 1, null, 4], [2, 3, null, 8], 0.5);
  assert.deepEqual(blended, [1, 2, null, 6]);
});

test('display frame snaps across algorithm changes instead of blending unlike modes', () => {
  const previous = {
    modeLabel: 'Conventional ping-pong',
    scenarioLabel: 'Healthy through current',
    waveforms: { local: [0], remoteReceived: [0], remoteAligned: [0], rawIdiff: [0], validatedIdiff: [0] }
  };
  const next = {
    modeLabel: 'Smart waveform tracking',
    scenarioLabel: 'Healthy through current',
    waveforms: { local: [1], remoteReceived: [1], remoteAligned: [1], rawIdiff: [1], validatedIdiff: [1] }
  };
  assert.equal(blendDisplayFrame(previous, next), next);
});

test('frame scale scans arrays without temporary flattened allocations', () => {
  const frame = {
    waveforms: {
      local: [-1.8, 1.2],
      remoteReceived: [null, -1.4],
      remoteAligned: [1.6, -1.1],
      rawIdiff: [0.2, 0.9],
      validatedIdiff: [0.1, 0.7]
    }
  };
  assert.deepEqual(frameScale(frame), { currentMax: 1.8, diffMax: 0.9 });
});
