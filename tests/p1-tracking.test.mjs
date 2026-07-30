import test from 'node:test';
import assert from 'node:assert/strict';
import { alignRemote } from '../src/engine/algorithms.js';
import { estimateLag, shiftSeries } from '../src/engine/math.js';
import { ALGORITHM_MODES, createDefaultConfig } from '../src/engine/constants.js';

function sineSeries(length, samplesPerCycle = 80, harmonic = 0.04) {
  return Float64Array.from({ length }, (_, index) => {
    const angle = (index / samplesPerCycle) * Math.PI * 2;
    return Math.sin(angle) + harmonic * Math.sin(3 * angle + 0.2);
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
    ...overrides
  };
}

test('sub-sample lag refinement improves fractional-delay estimate', () => {
  const reference = sineSeries(480);
  const candidate = shiftSeries(reference, -2.35);
  const estimate = estimateLag(reference, candidate, 8, 120, 460);
  assert.ok(Math.abs(estimate.refinedLagSamples - 2.35) < 0.18, `lag=${estimate.refinedLagSamples}`);
  assert.ok(Math.abs(estimate.subSampleOffset) > 0.05);
});

test('dual-horizon estimators agree on coherent waveform', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 4,
    trackerMaxSlewMs: 2
  };
  const local = sineSeries(480);
  const remote = shiftSeries(Float64Array.from(local, (value) => -value), -15.4);
  const result = alignRemote({
    local,
    remoteReceived: remote,
    config,
    channel: channel(),
    trackerState: { initialized: false, correctionMs: 0, velocityMs: 0, heldFrames: 0 }
  });
  assert.ok(result.tracker.estimatorAgreementMs < config.trackerAgreementMs);
  assert.equal(result.tracker.measurementAccepted, true);
  assert.ok(['FUSED', 'STABILITY', 'SHORT'].includes(result.tracker.source));
});

test('trajectory filter limits an abrupt correction request', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 5,
    trackerMaxSlewMs: 0.3,
    trackerAgreementMs: 0.6
  };
  const local = sineSeries(480);
  const remote = shiftSeries(Float64Array.from(local, (value) => -value), -24);
  const result = alignRemote({
    local,
    remoteReceived: remote,
    config,
    channel: channel({ rttStepMs: 2 }),
    trackerState: { initialized: true, correctionMs: 0, velocityMs: 0, heldFrames: 0 }
  });
  assert.ok(Math.abs(result.trackingCorrectionMs) <= 0.300001);
  assert.ok(Math.abs(result.tracker.trajectoryInnovationMs) >= 0.3);
});

test('incoherent short horizon is held instead of forcing aggressive correction', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 4,
    trackerMaxSlewMs: 0.4,
    trackerAgreementMs: 0.35
  };
  const local = sineSeries(480);
  const remote = shiftSeries(Float64Array.from(local, (value) => -value), -12);
  for (let index = 430; index < 480; index += 1) remote[index] = Math.sin(index * 0.71);
  const result = alignRemote({
    local,
    remoteReceived: remote,
    config,
    channel: channel(),
    trackerState: { initialized: true, correctionMs: 0.2, velocityMs: 0.03, heldFrames: 0 }
  });
  assert.ok(
    result.tracker.estimatorAgreementMs > config.trackerAgreementMs ||
    result.tracker.measurementAccepted === false
  );
  if (!result.tracker.measurementAccepted) assert.equal(result.tracker.source, 'HOLD');
});
