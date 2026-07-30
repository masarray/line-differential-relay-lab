import test from 'node:test';
import assert from 'node:assert/strict';
import { alignRemote } from '../src/engine/algorithms.js';
import { calculateConfidence } from '../src/engine/confidence.js';
import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, createDefaultConfig } from '../src/engine/constants.js';
import { Simulator } from '../src/engine/simulation.js';

function sineSeries(length, samplesPerCycle = 80) {
  return Float64Array.from({ length }, (_, index) => Math.sin((index / samplesPerCycle) * Math.PI * 2));
}

function delayedOpposite(reference, delaySamples) {
  const output = new Float64Array(reference.length);
  output.fill(Number.NaN);
  for (let index = delaySamples; index < output.length; index += 1) {
    output[index] = -reference[index - delaySamples];
  }
  return output;
}

function receiverChannel(overrides = {}) {
  return {
    rttMs: 6,
    rttStepMs: 0,
    rttJitterMs: 0,
    packetAgeMs: 3,
    observedLossFraction: 0,
    corruption: false,
    hardInvalid: false,
    timeSyncValid: false,
    absoluteTimeShiftMs: Number.NaN,
    timeReferenceUncertaintyMs: 0.05,
    ...overrides
  };
}

function countFinite(values) {
  return values.reduce((count, value) => count + Number.isFinite(value), 0);
}

test('smart tracker aligns without access to true forward or return delay', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    jitterMs: 0,
    trackWindowMs: 4,
    trackerMaxSlewMs: 2
  };
  const local = sineSeries(320);
  const remoteReceived = delayedOpposite(local, 12);
  const alignment = alignRemote({
    local,
    remoteReceived,
    config,
    channel: receiverChannel(),
    previousTrackingMs: 0
  });

  assert.ok(Number.isFinite(alignment.estimatedShiftMs));
  assert.ok(Math.abs(alignment.estimatedShiftMs - 3) < 0.3, `shift=${alignment.estimatedShiftMs}`);
  assert.ok(Math.abs(alignment.trackingCorrelation) > 0.98);
});

test('interpolated samples remain tracking-only and cannot become protection evidence', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    jitterMs: 0,
    trackWindowMs: 4,
    trackerMaxSlewMs: 2
  };
  const local = sineSeries(320);
  const remoteReceived = delayedOpposite(local, 12);
  remoteReceived.fill(Number.NaN, 180, 184);

  const alignment = alignRemote({
    local,
    remoteReceived,
    config,
    channel: receiverChannel(),
    previousTrackingMs: 0
  });

  assert.ok(alignment.tracker.predictedFraction > 0);
  assert.ok(
    countFinite(alignment.alignedTracking) > countFinite(alignment.alignedProtection),
    'tracking buffer should contain estimator-only interpolation while protection retains gaps'
  );
});

test('confidence result ignores simulation ground-truth fields', () => {
  const config = { ...createDefaultConfig(), algorithm: ALGORITHM_MODES.SMART_TRACKING };
  const alignment = {
    uncertaintyMs: 0.16,
    trackingCorrectionMs: 0.4,
    protectionCorrelation: -0.99,
    trackingCorrelation: -0.99,
    tracker: {
      peakScore: 0.99,
      ambiguity: 0.8,
      predictedFraction: 0,
      atSearchBoundary: false
    }
  };
  const base = receiverChannel({ timeSyncValid: true });
  const a = calculateConfidence({
    config,
    channel: { ...base, forwardMs: 2, returnMs: 12, clockErrorMs: 7 },
    alignment,
    validFraction: 0.98,
    protectionValidFraction: 0.98
  });
  const b = calculateConfidence({
    config,
    channel: { ...base, forwardMs: 19, returnMs: 0.2, clockErrorMs: -4 },
    alignment,
    validFraction: 0.98,
    protectionValidFraction: 0.98
  });

  assert.deepEqual(a, b);
});

test('insufficient measured coverage inhibits trip even during internal fault', () => {
  const simulator = new Simulator({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    scenario: ELECTRICAL_SCENARIOS.INTERNAL_FAULT,
    packetLossPct: 38,
    burstLossPct: 0,
    corruptionPct: 0,
    jitterMs: 0.1,
    asymmetryMs: 0.2
  });

  let frame;
  for (let index = 0; index < 30; index += 1) frame = simulator.step(40);

  assert.equal(frame.differential.measuredEvidenceValid, false);
  assert.equal(frame.protection.tripAllowed, false);
  assert.equal(frame.protection.operate, false);
  assert.ok(frame.confidence.reasons.includes('INSUFFICIENT_MEASURED_DATA'));
  assert.ok(Number.isFinite(frame.diagnostics.groundTruthResidualMs));
});
