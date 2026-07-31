import test from 'node:test';
import assert from 'node:assert/strict';

import { generateStressSchedule, runLongHorizonReplay } from '../src/validation/long-horizon-stress.js';

test('P6 keeps a deterministic P5 replay secure while restoring availability', () => {
  const schedule = generateStressSchedule(2095413052, { episodes: 30 });
  const replay = runLongHorizonReplay(schedule, 'smart-waveform-assisted', {
    stepMs: 20,
    warmupMs: 420,
    stopAfterFirstTrip: false
  });

  assert.equal(replay.unwantedTrip, false);
  assert.equal(replay.operationCount, 0);
  assert.ok(replay.availabilityPct > 20, `availability was ${replay.availabilityPct}%`);
});
