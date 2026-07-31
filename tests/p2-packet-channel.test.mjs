import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacketChannelWindow } from '../src/engine/channel-model.js';
import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, createDefaultConfig } from '../src/engine/constants.js';
import { Simulator } from '../src/engine/simulation.js';

function transport(overrides = {}, timeSeconds = 1) {
  const config = { ...createDefaultConfig(), ...overrides };
  return createPacketChannelWindow({
    config,
    simulationTimeSeconds: timeSeconds,
    frameIndex: Math.round(timeSeconds * 25),
    windowStartSeconds: timeSeconds - 0.08,
    sampleCount: 320,
    sampleValueAt: (time) => Math.sin(2 * Math.PI * 50 * time)
  });
}

function finiteCount(values) {
  let count = 0;
  for (const value of values) if (Number.isFinite(value)) count += 1;
  return count;
}

test('packet loss rejects complete frames and exposes sequence gaps', () => {
  const result = transport({ packetLossPct: 100 });
  const receiver = result.snapshot.receiver;
  assert.ok(receiver.expectedFrames > 0);
  assert.equal(receiver.receivedFrames, 0);
  assert.equal(receiver.lostFrames, receiver.expectedFrames);
  assert.equal(receiver.sequenceGapCount, 1);
  assert.equal(finiteCount(result.remoteReceived), 0);
  assert.equal(result.snapshot.hardInvalid, true);
});

test('duplicates are detected and discarded without replacing measured evidence', () => {
  const result = transport({ duplicatePct: 100, packetLossPct: 0, reorderPct: 0 });
  const receiver = result.snapshot.receiver;
  assert.equal(receiver.duplicateFrames, receiver.expectedFrames);
  assert.equal(receiver.sequenceGapCount, 0);
  assert.equal(receiver.receivedFrames, receiver.expectedFrames);
  assert.ok(finiteCount(result.remoteReceived) > 280);
  assert.equal(result.snapshot.hardInvalid, false);
});

test('bounded receiver queue reorders delayed frames without a sequence gap', () => {
  const result = transport({
    reorderPct: 100,
    reorderExtraDelayMs: 10,
    reorderBufferFrames: 5,
    maxReceiverQueueFrames: 8,
    packetAbsoluteAgeMs: 30
  });
  const receiver = result.snapshot.receiver;
  assert.ok(receiver.reorderedFrames > 0);
  assert.ok(receiver.maxReorderDepth > 0);
  assert.equal(receiver.lateFrames, 0);
  assert.equal(receiver.sequenceGapCount, 0);
  assert.equal(receiver.receivedFrames, receiver.expectedFrames);
  assert.equal(result.snapshot.hardInvalid, false);
});

test('reorder beyond the configured buffer becomes late packet gaps', () => {
  const result = transport({
    reorderPct: 100,
    reorderExtraDelayMs: 10,
    reorderBufferFrames: 0,
    packetAbsoluteAgeMs: 30
  });
  const receiver = result.snapshot.receiver;
  assert.ok(receiver.lateFrames > 0);
  assert.ok(receiver.sequenceGapCount > 0);
  assert.ok(receiver.receivedFrames < receiver.expectedFrames);
});

test('receiver queue overflow is a hard-invalid communication condition', () => {
  const result = transport({
    reorderPct: 100,
    reorderExtraDelayMs: 15,
    reorderBufferFrames: 8,
    maxReceiverQueueFrames: 1,
    packetAbsoluteAgeMs: 40
  });
  assert.ok(result.snapshot.receiver.queueOverflowFrames > 0);
  assert.equal(result.snapshot.hardInvalid, true);
});

test('deterministic route step changes one-way delay and flags transition', () => {
  const before = transport({ routeChangeAtMs: 600, routeStepDeltaMs: 4, routeRampMs: 0 }, 0.55);
  const during = transport({ routeChangeAtMs: 600, routeStepDeltaMs: 4, routeRampMs: 0 }, 0.602);
  assert.ok(Math.abs(before.snapshot.routeOffsetMs) < 1e-9);
  assert.ok(during.snapshot.routeOffsetMs > 3.9);
  assert.equal(during.snapshot.receiver.routeTransitionActive, true);
  assert.ok(during.snapshot.rttMs > before.snapshot.rttMs + 3);
});

test('smart tracking does not operate on through current during packet disorder', () => {
  const simulator = new Simulator({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    duplicatePct: 25,
    reorderPct: 35,
    reorderExtraDelayMs: 5,
    reorderBufferFrames: 3,
    maxReceiverQueueFrames: 8,
    packetAbsoluteAgeMs: 30,
    jitterMs: 0.25
  });
  let frame;
  for (let index = 0; index < 30; index += 1) frame = simulator.step(40);
  assert.equal(frame.protection.operate, false);
  assert.notEqual(frame.protection.decision, 'OPERATE');
  assert.ok(frame.channel.duplicateFrames > 0 || frame.channel.reorderedFrames > 0);
});
