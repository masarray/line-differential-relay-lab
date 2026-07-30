import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelayLatchState, resetRelayLatch, updateRelayLatch } from '../src/ui/relay-latch.js';

function frame(operate, timeSeconds = 1.25) {
  return {
    timeSeconds,
    modeLabel: 'Smart waveform tracking',
    scenarioLabel: 'Internal fault',
    differential: { validatedRmsPu: 1.42, restraintRmsPu: 0.91 },
    protection: { operate }
  };
}

test('virtual relay trip state latches on first operate frame', () => {
  const initial = createRelayLatchState();
  const latched = updateRelayLatch(initial, frame(true));
  assert.equal(latched.latched, true);
  assert.equal(latched.tripTimeSeconds, 1.25);
  assert.equal(latched.idiffPu, 1.42);
});

test('latched trip memory remains after operate condition clears', () => {
  const latched = updateRelayLatch(createRelayLatchState(), frame(true));
  const retained = updateRelayLatch(latched, frame(false, 2));
  assert.strictEqual(retained, latched);
});

test('manual reset clears only after operate condition is inactive', () => {
  const latched = updateRelayLatch(createRelayLatchState(), frame(true));
  const inhibited = resetRelayLatch(latched, true);
  assert.equal(inhibited.latched, true);
  assert.equal(inhibited.resetInhibited, true);

  const cleared = resetRelayLatch(latched, false);
  assert.equal(cleared.latched, false);
  assert.equal(cleared.tripTimeSeconds, null);
});
