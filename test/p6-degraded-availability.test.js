import test from 'node:test';
import assert from 'node:assert/strict';

import { ALGORITHM_MODES, PROTECTION_STATES, createDefaultConfig } from '../src/engine/constants.js';
import { calculateConfidence } from '../src/engine/confidence.js';
import { sanitizeConfig } from '../src/engine/schema.js';
import { ProtectionStateMachine } from '../src/engine/state-machine.js';

function degradedConfidenceFixture(overrides = {}) {
  return {
    channel: { score: 74, status: 'DEGRADED' },
    alignment: { score: 72, status: 'DEGRADED' },
    waveform: { score: 76, status: 'DEGRADED' },
    minimumScore: 72,
    hardInvalid: false,
    degradedEligible: true,
    degradedEvidence: {
      measuredCoverageValid: true,
      trajectoryPlausible: true,
      uncertaintyValid: true,
      predictionValid: true
    },
    trustedElectricalHold: false,
    reasons: ['DEGRADED_OPERATION_AVAILABLE'],
    ...overrides
  };
}

test('smart confidence qualifies measured degraded operation without relaxing hard vetoes', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING
  });
  const confidence = calculateConfidence({
    config,
    channel: {
      rttJitterMs: 0.2,
      rttStepMs: 0.1,
      packetAgeMs: 5,
      observedLossFraction: 0.01,
      corruption: false,
      hardInvalid: false,
      sequenceGapCount: 0,
      maxConsecutiveLossFrames: 0,
      duplicateFrames: 0,
      reorderedFrames: 0,
      lateFrames: 0,
      queueDepthFrames: 1,
      queueOverflowFrames: 0,
      routeTransitionActive: false,
      timeSyncValid: true
    },
    alignment: {
      uncertaintyMs: 0.5,
      trackingCorrectionMs: 0.4,
      protectionCorrelation: -0.95,
      tracker: {
        short: { peakScore: 0.96, peakCurvature: 0.8 },
        stable: { peakScore: 0.96, peakCurvature: 0.8 },
        estimatorAgreementMs: 0.25,
        trajectoryInnovationMs: 0.1,
        measurementAccepted: true,
        electricalHold: false,
        predictedFraction: 0.01,
        atSearchBoundary: false,
        innovationClamped: false,
        ambiguity: 0.2,
        peakScore: 0.96
      }
    },
    validFraction: 0.98,
    protectionValidFraction: 0.96
  });

  assert.equal(confidence.hardInvalid, false);
  assert.equal(confidence.degradedEligible, true);
  assert.equal(confidence.degradedEvidence.measuredCoverageValid, true);
});

test('smart state enters degraded supervised operation instead of soft blocking', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    degradedRecoveryMs: 60
  });
  const machine = new ProtectionStateMachine(config);

  let snapshot = machine.update({ config, confidence: degradedConfidenceFixture(), deltaMs: 20 });
  assert.equal(snapshot.state, PROTECTION_STATES.WATCH);
  assert.equal(snapshot.displayState, 'DEGRADED 87L');
  assert.equal(snapshot.permission, 'DEGRADED SUPERVISED');
  assert.equal(snapshot.degraded, true);

  for (let index = 0; index < 30; index += 1) {
    snapshot = machine.update({ config, confidence: degradedConfidenceFixture(), deltaMs: 20 });
  }
  assert.equal(snapshot.state, PROTECTION_STATES.WATCH);
  assert.notEqual(snapshot.permission, 'BLOCKED');
});

test('hard-invalid communication still blocks and cannot be bypassed by degraded eligibility', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING
  });
  const machine = new ProtectionStateMachine(config);
  const snapshot = machine.update({
    config,
    confidence: degradedConfidenceFixture({
      hardInvalid: true,
      reasons: ['PACKET_INTEGRITY_FAIL']
    }),
    deltaMs: 20
  });

  assert.equal(snapshot.state, PROTECTION_STATES.BLOCKED);
  assert.equal(snapshot.permission, 'BLOCKED');
  assert.equal(snapshot.degraded, false);
});

test('smart protection reopens from hard block through bounded degraded validation', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    degradedRecoveryMs: 60
  });
  const machine = new ProtectionStateMachine(config);

  machine.update({
    config,
    confidence: degradedConfidenceFixture({ hardInvalid: true, reasons: ['PACKET_STALE'] }),
    deltaMs: 20
  });

  let snapshot;
  for (let index = 0; index < 2; index += 1) {
    snapshot = machine.update({ config, confidence: degradedConfidenceFixture(), deltaMs: 20 });
    assert.equal(snapshot.permission, 'BLOCKED');
  }

  snapshot = machine.update({ config, confidence: degradedConfidenceFixture(), deltaMs: 20 });
  assert.equal(snapshot.state, PROTECTION_STATES.WATCH);
  assert.equal(snapshot.permission, 'DEGRADED SUPERVISED');
});

test('degraded configuration remains bounded by schema safety limits', () => {
  const config = sanitizeConfig({
    degradedRecoveryMs: 1,
    degradedMinChannelScore: 10,
    degradedMinAlignmentScore: 100,
    degradedMinWaveformScore: 100,
    degradedMaxUncertaintyMs: 10,
    degradedMaxPredictedFraction: 1
  });

  assert.equal(config.degradedRecoveryMs, 20);
  assert.equal(config.degradedMinChannelScore, 42);
  assert.equal(config.degradedMinAlignmentScore, 90);
  assert.equal(config.degradedMinWaveformScore, 90);
  assert.equal(config.degradedMaxUncertaintyMs, 2.5);
  assert.equal(config.degradedMaxPredictedFraction, 0.35);
});
