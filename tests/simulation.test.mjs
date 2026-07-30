import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, createDefaultConfig } from '../src/engine/constants.js';
import { Simulator } from '../src/engine/simulation.js';

function run(config, frames = 12) {
  const simulator = new Simulator(config);
  let frame;
  for (let index = 0; index < frames; index += 1) frame = simulator.step(40);
  return frame;
}

test('ideal through current remains stable with low Idiff', () => {
  const frame = run({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.PING_PONG,
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    jitterMs: 0,
    asymmetryMs: 0,
    clockOffsetMs: 0,
    clockDriftPpm: 0
  });
  assert.ok(frame.differential.validatedRmsPu < 0.04, `Idiff=${frame.differential.validatedRmsPu}`);
  assert.equal(frame.protection.decision, 'STABLE');
});

test('internal fault produces an operate decision', () => {
  const frame = run({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    scenario: ELECTRICAL_SCENARIOS.INTERNAL_FAULT,
    jitterMs: 0.15,
    asymmetryMs: 0.2
  }, 20);
  assert.ok(frame.differential.validatedRmsPu > frame.differential.pickupPu);
  assert.equal(frame.protection.decision, 'OPERATE');
});

test('smart tracking reduces false Idiff from path asymmetry', () => {
  const base = {
    ...createDefaultConfig(),
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    asymmetryMs: 3.6,
    jitterMs: 0,
    clockOffsetMs: 0,
    clockDriftPpm: 0,
    trackerMaxSlewMs: 1.5,
    trackWindowMs: 4
  };
  const conventional = run({ ...base, algorithm: ALGORITHM_MODES.PING_PONG }, 15);
  const smart = run({ ...base, algorithm: ALGORITHM_MODES.SMART_TRACKING }, 15);
  assert.ok(
    smart.differential.validatedRmsPu < conventional.differential.validatedRmsPu * 0.55,
    `smart=${smart.differential.validatedRmsPu}, conventional=${conventional.differential.validatedRmsPu}`
  );
});

test('GPS alignment is insensitive to symmetric channel latency when clocks are valid', () => {
  const frame = run({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.GPS,
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    baseDelayMs: 11,
    asymmetryMs: 6,
    jitterMs: 0,
    clockOffsetMs: 0,
    clockDriftPpm: 0,
    gpsSyncValid: true
  });
  assert.ok(frame.differential.validatedRmsPu < 0.04, `Idiff=${frame.differential.validatedRmsPu}`);
});

test('hard packet invalidity blocks supervised algorithms', () => {
  const frame = run({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SECURE_WINDOW,
    corruptionPct: 100
  }, 2);
  assert.equal(frame.protection.permission, 'BLOCKED');
});
