import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHM_MODES, PROTECTION_STATES, createDefaultConfig } from '../src/engine/constants.js';
import { ProtectionStateMachine } from '../src/engine/state-machine.js';

function confidence(score, hardInvalid = false) {
  return { minimumScore: score, hardInvalid, reasons: [hardInvalid ? 'PACKET_INTEGRITY_FAIL' : 'TEST'] };
}

test('secure algorithm rides through briefly then blocks', () => {
  const config = { ...createDefaultConfig(), algorithm: ALGORITHM_MODES.SECURE_WINDOW, secureWindowMs: 100 };
  const machine = new ProtectionStateMachine(config);
  machine.update({ config, confidence: confidence(50), deltaMs: 20 });
  assert.equal(machine.state, PROTECTION_STATES.WATCH);
  machine.update({ config, confidence: confidence(50), deltaMs: 20 });
  assert.equal(machine.state, PROTECTION_STATES.SECURE);
  for (let index = 0; index < 5; index += 1) machine.update({ config, confidence: confidence(50), deltaMs: 20 });
  assert.equal(machine.state, PROTECTION_STATES.BLOCKED);
});

test('hard invalidity blocks immediately', () => {
  const config = { ...createDefaultConfig(), algorithm: ALGORITHM_MODES.SMART_TRACKING };
  const machine = new ProtectionStateMachine(config);
  machine.update({ config, confidence: confidence(95, true), deltaMs: 20 });
  assert.equal(machine.state, PROTECTION_STATES.BLOCKED);
});
