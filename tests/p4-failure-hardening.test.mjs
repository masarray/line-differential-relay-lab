import test from 'node:test';
import assert from 'node:assert/strict';
import { alignRemote } from '../src/engine/algorithms.js';
import { shiftSeries } from '../src/engine/math.js';
import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, createDefaultConfig } from '../src/engine/constants.js';
import { Simulator } from '../src/engine/simulation.js';

function sineSeries(length, polarity = 1, samplesPerCycle = 80) {
  return Float64Array.from({ length }, (_, index) => {
    const angle = index / samplesPerCycle * Math.PI * 2;
    return polarity * (Math.sin(angle) + 0.04 * Math.sin(3 * angle + 0.17));
  });
}

function channel(overrides = {}) {
  return {
    rttMs: 6,
    rttStepMs: 0,
    rttJitterMs: 0,
    packetAgeMs: 3,
    corruption: false,
    hardInvalid: false,
    timeSyncValid: false,
    knownTransportLatencyMs: 0,
    ...overrides
  };
}

test('coherent polarity reversal freezes the last trusted timing correction', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 4,
    trackerMaxSlewMs: 0.5
  };
  const local = sineSeries(480, 1);
  const remoteInternal = shiftSeries(sineSeries(480, 1), -12.8);
  const trustedCorrectionMs = 0.72;
  const result = alignRemote({
    local,
    remoteReceived: remoteInternal,
    config,
    channel: channel(),
    trackerState: {
      initialized: true,
      correctionMs: trustedCorrectionMs,
      velocityMs: 0.18,
      heldFrames: 0,
      electricalHoldFrames: 0
    }
  });

  assert.equal(result.tracker.electricalHold, true);
  assert.equal(result.tracker.source, 'ELECTRICAL_HOLD');
  assert.equal(result.tracker.measurementAccepted, false);
  assert.ok(Math.abs(result.trackingCorrectionMs - trustedCorrectionMs) < 1e-9);
  assert.equal(result.trackerState.velocityMs, 0);
});

test('normal anti-polarity through-current remains available for timing adaptation', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 4,
    trackerMaxSlewMs: 0.5
  };
  const local = sineSeries(480, 1);
  const remoteThrough = shiftSeries(sineSeries(480, -1), -15.2);
  const result = alignRemote({
    local,
    remoteReceived: remoteThrough,
    config,
    channel: channel({ rttStepMs: 0.8 }),
    trackerState: {
      initialized: true,
      correctionMs: 0.1,
      velocityMs: 0,
      heldFrames: 0,
      electricalHoldFrames: 0
    }
  });

  assert.equal(result.tracker.electricalHold, false);
  assert.notEqual(result.tracker.source, 'ELECTRICAL_HOLD');
});

test('smart tracker preserves internal-fault operation after a healthy warm-up', () => {
  const simulator = new Simulator({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    asymmetryMs: 2.8,
    jitterMs: 0.18,
    duplicatePct: 6,
    reorderPct: 8,
    reorderExtraDelayMs: 2.5,
    packetAbsoluteAgeMs: 30
  });

  for (let index = 0; index < 20; index += 1) simulator.step(20);
  simulator.setConfig({ scenario: ELECTRICAL_SCENARIOS.INTERNAL_FAULT });

  let operated = false;
  let electricalHoldObserved = false;
  for (let index = 0; index < 32; index += 1) {
    const frame = simulator.step(20);
    operated ||= frame.protection.operate;
    electricalHoldObserved ||= frame.confidence.reasons.includes('ELECTRICAL_TRANSIENT_HOLD');
  }

  assert.equal(electricalHoldObserved, true);
  assert.equal(operated, true);
});

test('through-current packet disorder remains secure without unwanted operation', () => {
  const simulator = new Simulator({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    asymmetryMs: 4.2,
    jitterMs: 0.75,
    packetLossPct: 1.4,
    burstLossPct: 1.2,
    duplicatePct: 18,
    reorderPct: 28,
    reorderExtraDelayMs: 6,
    reorderBufferFrames: 3,
    maxReceiverQueueFrames: 8,
    packetAbsoluteAgeMs: 32,
    routeChangeAtMs: 420,
    routeStepDeltaMs: 3.8,
    routeRampMs: 60
  });

  let operated = false;
  for (let index = 0; index < 70; index += 1) operated ||= simulator.step(20).protection.operate;
  assert.equal(operated, false);
});
