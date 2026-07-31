import test from 'node:test';
import assert from 'node:assert/strict';
import { alignRemote } from '../src/engine/algorithms.js';
import { createPacketChannelWindow } from '../src/engine/channel-model.js';
import { ALGORITHM_MODES, createDefaultConfig } from '../src/engine/constants.js';
import {
  evaluateStrongMeasuredDifferential,
  evaluateThroughPolaritySecurity,
  updateStrongMeasuredEvidence
} from '../src/engine/evidence-policy.js';
import { normalizedCorrelation, shiftSeries } from '../src/engine/math.js';
import { generateValidationCase, runValidationCase } from '../src/validation/monte-carlo.js';

function sineSeries(length, samplesPerCycle = 80, harmonic = 0.04) {
  return Float64Array.from({ length }, (_, index) => {
    const angle = (index / samplesPerCycle) * Math.PI * 2;
    return Math.sin(angle) + harmonic * Math.sin(3 * angle + 0.2);
  });
}

test('bounded packet reordering preserves a uniform receiver sample time base', () => {
  const config = {
    ...createDefaultConfig(),
    baseDelayMs: 4,
    asymmetryMs: 2,
    jitterMs: 0.6,
    packetSamples: 8,
    packetSerializationMs: 0.3,
    reorderPct: 100,
    reorderExtraDelayMs: 3,
    reorderBufferFrames: 4,
    maxReceiverQueueFrames: 8,
    packetAbsoluteAgeMs: 40,
    packetLossPct: 0,
    burstLossPct: 0,
    corruptionPct: 0,
    clockOffsetMs: 0,
    clockDriftPpm: 0
  };
  const sampleCount = 400;
  const simulationTimeSeconds = 1;
  const windowStartSeconds = simulationTimeSeconds - sampleCount / config.sampleRateHz;
  const transport = createPacketChannelWindow({
    config,
    simulationTimeSeconds,
    frameIndex: 25,
    windowStartSeconds,
    sampleCount,
    sampleValueAt: (time) => -Math.sin(2 * Math.PI * config.frequencyHz * time)
  });
  const local = Float64Array.from({ length: sampleCount }, (_, index) =>
    Math.sin(2 * Math.PI * config.frequencyHz * (windowStartSeconds + index / config.sampleRateHz))
  );
  const knownDelayMs = config.baseDelayMs + config.asymmetryMs / 2 +
    config.packetSerializationMs + transport.snapshot.playoutBufferMs;
  const aligned = shiftSeries(transport.remoteReceived, knownDelayMs * config.sampleRateHz / 1000);
  assert.ok(transport.snapshot.receiver.reorderedFrames > 0);
  assert.equal(transport.snapshot.receiver.lateFrames, 0);
  assert.ok(Math.abs(normalizedCorrelation(local, aligned, 80, 300)) > 0.995);
});

test('smart short and stability estimators use common overlap at large transport delay', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 4,
    trackerMaxSlewMs: 2
  };
  const local = sineSeries(480);
  const remote = shiftSeries(Float64Array.from(local, (value) => -value), -52.4);
  const result = alignRemote({
    local,
    remoteReceived: remote,
    config,
    channel: {
      rttMs: 8,
      knownTransportLatencyMs: 8,
      rttStepMs: 0,
      rttJitterMs: 0,
      packetAgeMs: 12,
      hardInvalid: false,
      corruption: false,
      timeSyncValid: false
    },
    trackerState: { initialized: false, correctionMs: 0, velocityMs: 0, heldFrames: 0 }
  });
  assert.ok(result.tracker.short.peakScore > 0.9);
  assert.ok(result.tracker.stable.peakScore > 0.9);
  assert.ok(result.tracker.estimatorAgreementMs < config.trackerAgreementMs);
});

test('through-polarity restraint is generic and excludes the conventional baseline', () => {
  assert.equal(evaluateThroughPolaritySecurity({
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    protectionValidFraction: 0.98,
    signedCorrelation: -0.92
  }), true);
  assert.equal(evaluateThroughPolaritySecurity({
    algorithm: ALGORITHM_MODES.PING_PONG,
    protectionValidFraction: 0.98,
    signedCorrelation: -0.92
  }), false);
  assert.equal(evaluateThroughPolaritySecurity({
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    protectionValidFraction: 0.98,
    signedCorrelation: 0.92
  }), false);
});

test('strong measured differential requires coherent measured evidence and hard-invalid remains a veto', () => {
  const tracker = {
    measurementAccepted: true,
    configuredAgreementMs: 0.6,
    estimatorAgreementMs: 0.08,
    predictedFraction: 0,
    short: { peakScore: 0.99 },
    stable: { peakScore: 0.995 }
  };
  const evidence = {
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    hardInvalid: false,
    configuredMinimumCoverage: 0.9,
    protectionValidFraction: 0.9,
    idiffRmsPu: 1.5,
    pickupPu: 0.4,
    signedCorrelation: 0.96,
    tracker
  };
  assert.equal(evaluateStrongMeasuredDifferential(evidence), true);
  assert.equal(evaluateStrongMeasuredDifferential({ ...evidence, hardInvalid: true }), false);
  const accumulated = updateStrongMeasuredEvidence({ previousMs: 40, candidate: true, hardInvalid: false, deltaMs: 20 });
  assert.equal(accumulated.operate, true);
  const vetoed = updateStrongMeasuredEvidence({ previousMs: 80, candidate: true, hardInvalid: true, deltaMs: 20 });
  assert.deepEqual(vetoed, { evidenceMs: 0, operate: false });
});

test('P3 failure seeds replay securely and dependably after P4 hardening', () => {
  const externalFailure = generateValidationCase(1, { seed: 61850 });
  const externalRun = runValidationCase(externalFailure, ALGORITHM_MODES.SMART_TRACKING);
  assert.equal(externalRun.caseSeed, 1453102326);
  assert.equal(externalRun.unwantedTrip, false);

  const internalFailure = generateValidationCase(2, { seed: 61850 });
  const internalRun = runValidationCase(internalFailure, ALGORITHM_MODES.SMART_TRACKING);
  assert.equal(internalRun.caseSeed, 1520509160);
  assert.equal(internalRun.dependabilityEligible, true);
  assert.equal(internalRun.missedEligibleTrip, false);
  assert.equal(internalRun.operatedDuringEvent, true);
});
