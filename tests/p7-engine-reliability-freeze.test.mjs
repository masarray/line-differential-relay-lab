import test from 'node:test';
import assert from 'node:assert/strict';

import { alignRemote } from '../src/engine/algorithms.js';
import { calculateConfidence } from '../src/engine/confidence.js';
import {
  ALGORITHM_MODES,
  ELECTRICAL_SCENARIOS,
  PROTECTION_STATES,
  createDefaultConfig
} from '../src/engine/constants.js';
import { guardProtectionPermission, SAFETY_INVARIANTS } from '../src/engine/safety-invariants.js';
import { sanitizeConfig } from '../src/engine/schema.js';
import { Simulator } from '../src/engine/simulation.js';
import { ProtectionStateMachine } from '../src/engine/state-machine.js';

function sineSeries(length, polarity = 1, samplesPerCycle = 80) {
  return Float64Array.from({ length }, (_, index) =>
    polarity * (Math.sin(index / samplesPerCycle * Math.PI * 2) + 0.03 * Math.sin(index / samplesPerCycle * Math.PI * 6 + 0.2))
  );
}

function receiverChannel(overrides = {}) {
  return {
    rttMs: 6,
    rttStepMs: 0.05,
    rttJitterMs: 0.08,
    packetAgeMs: 5,
    observedLossFraction: 0,
    corruption: false,
    hardInvalid: false,
    timeSyncValid: false,
    sequenceGapCount: 0,
    maxConsecutiveLossFrames: 0,
    duplicateFrames: 0,
    reorderedFrames: 0,
    lateFrames: 0,
    queueDepthFrames: 1,
    queueOverflowFrames: 0,
    routeTransitionActive: false,
    knownTransportLatencyMs: 0,
    ...overrides
  };
}

function confidenceAlignment(config, overrides = {}) {
  return {
    uncertaintyMs: 0.35,
    trackingCorrectionMs: 0.3,
    trackingCorrelation: -0.96,
    protectionCorrelation: -0.96,
    tracker: {
      short: { peakScore: 0.97, peakCurvature: 0.8 },
      stable: { peakScore: 0.97, peakCurvature: 0.8 },
      estimatorAgreementMs: 0.12,
      trajectoryInnovationMs: 0.05,
      measurementAccepted: true,
      electricalHold: false,
      electricalHoldAgeMs: 0,
      correctionAgeMs: 0,
      predictedFraction: 0,
      atSearchBoundary: false,
      innovationClamped: false,
      ambiguity: 0.1,
      peakScore: 0.97,
      ...overrides
    }
  };
}

test('stale correction cannot qualify degraded operation or trusted electrical hold', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    degradedMaxCorrectionAgeMs: 100,
    secureMaxCorrectionAgeMs: 220,
    strongEvidenceMaxCorrectionAgeMs: 50,
    maxElectricalHoldAgeMs: 60
  });

  const stale = calculateConfidence({
    config,
    channel: receiverChannel(),
    alignment: confidenceAlignment(config, {
      measurementAccepted: false,
      electricalHold: true,
      correctionAgeMs: 140,
      electricalHoldAgeMs: 80
    }),
    validFraction: 0.98,
    protectionValidFraction: 0.96
  });

  assert.equal(stale.degradedEligible, false);
  assert.equal(stale.trustedElectricalHold, false);
  assert.equal(stale.degradedEvidence.correctionFresh, false);
  assert.ok(stale.reasons.includes('ALIGNMENT_CORRECTION_STALE'));
  assert.ok(stale.reasons.includes('ELECTRICAL_HOLD_EXPIRED'));
});

test('expired alignment remains in smart revalidation and cannot restore normal permission', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    degradedRecoveryMs: 40
  });
  const machine = new ProtectionStateMachine(config);
  const expired = {
    channel: { score: 95, status: 'GOOD' },
    alignment: { score: 90, status: 'GOOD' },
    waveform: { score: 95, status: 'GOOD' },
    minimumScore: 90,
    hardInvalid: false,
    alignmentExpired: true,
    correctionAgeMs: config.secureMaxCorrectionAgeMs + 20,
    degradedEligible: false,
    trustedElectricalHold: false,
    reasons: ['ALIGNMENT_CORRECTION_EXPIRED']
  };

  let snapshot = machine.update({ config, confidence: expired, deltaMs: 20 });
  assert.equal(snapshot.state, PROTECTION_STATES.SECURE);
  for (let index = 0; index < 10; index += 1) {
    snapshot = machine.update({ config, confidence: expired, deltaMs: 20 });
  }
  assert.equal(snapshot.state, PROTECTION_STATES.SECURE);
  assert.equal(snapshot.permission, 'RAISED SECURITY');
});

test('runtime invariant guard vetoes hard-invalid, stale, and unqualified degraded permission', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    degradedMaxCorrectionAgeMs: 100
  });
  const guarded = guardProtectionPermission({
    config,
    confidence: {
      hardInvalid: true,
      correctionAgeMs: 180,
      degradedEligible: false,
      trustedElectricalHold: false
    },
    protection: {
      state: PROTECTION_STATES.WATCH,
      permission: 'DEGRADED SUPERVISED'
    },
    measuredEvidenceValid: true,
    proposedTripAllowed: true,
    strongInternalEvidence: false,
    degradedSupervised: false
  });

  assert.equal(guarded.tripAllowed, false);
  assert.ok(guarded.violations.includes(SAFETY_INVARIANTS.HARD_INVALID_VETO));
  assert.ok(guarded.violations.includes(SAFETY_INVARIANTS.DEGRADED_GATE_REQUIRED));
  assert.ok(guarded.violations.includes(SAFETY_INVARIANTS.FRESH_ALIGNMENT_REQUIRED));
});

test('tracker correction age increases during hold and resets after accepted measurement', () => {
  const config = sanitizeConfig({
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    trackWindowMs: 4
  });
  const local = sineSeries(480, 1);
  const noEvidence = new Float64Array(480);
  noEvidence.fill(Number.NaN);
  const held = alignRemote({
    local,
    remoteReceived: noEvidence,
    config,
    channel: receiverChannel(),
    deltaMs: 20,
    trackerState: {
      initialized: true,
      correctionMs: 0.4,
      velocityMs: 0,
      heldFrames: 0,
      electricalHoldFrames: 0,
      correctionAgeMs: 40,
      electricalHoldAgeMs: 0,
      lastAcceptedSource: 'FUSED'
    }
  });
  assert.equal(held.tracker.measurementAccepted, false);
  assert.equal(held.tracker.correctionAgeMs, 60);

  const accepted = alignRemote({
    local,
    remoteReceived: sineSeries(480, -1),
    config,
    channel: receiverChannel(),
    deltaMs: 20,
    trackerState: held.trackerState
  });
  assert.equal(accepted.tracker.measurementAccepted, true);
  assert.equal(accepted.tracker.correctionAgeMs, 0);
});

test('constant-RTT one-way asymmetry shocks do not create strong internal evidence on non-internal cases', () => {
  const scenarios = [ELECTRICAL_SCENARIOS.THROUGH, ELECTRICAL_SCENARIOS.EXTERNAL_FAULT, ELECTRICAL_SCENARIOS.CT_ERROR];
  const asymmetries = [-11.2, -8.5, 8.5, 11.2];
  const frequencies = [49, 50, 51];
  const phases = [-6, 0, 6];

  for (const scenario of scenarios) {
    for (const asymmetryMs of asymmetries) {
      for (const frequencyHz of frequencies) {
        for (const remotePhaseDeg of phases) {
          const simulator = new Simulator({
            ...createDefaultConfig(),
            algorithm: ALGORITHM_MODES.SMART_TRACKING,
            scenario,
            frequencyHz,
            baseDelayMs: 8,
            asymmetryMs: 0,
            jitterMs: 0.08,
            packetLossPct: 0,
            burstLossPct: 0,
            duplicatePct: 0,
            reorderPct: 0,
            remotePhaseDeg,
            remoteMagnitudePct: scenario === ELECTRICAL_SCENARIOS.CT_ERROR ? 92 : 100,
            harmonic3Pct: scenario === ELECTRICAL_SCENARIOS.CT_ERROR ? 5 : 1,
            halfWaveAsymmetryPct: scenario === ELECTRICAL_SCENARIOS.CT_ERROR ? 8 : 0,
            packetAbsoluteAgeMs: 40
          });

          for (let index = 0; index < 18; index += 1) simulator.step(20);
          simulator.setConfig({ asymmetryMs });

          for (let index = 0; index < 24; index += 1) {
            const frame = simulator.step(20);
            const context = JSON.stringify({ scenario, asymmetryMs, frequencyHz, remotePhaseDeg, frame });
            assert.equal(frame.differential.strongInternalEvidence, false, context);
            assert.equal(frame.protection.operate, false, context);
            assert.deepEqual(frame.protection.safetyInvariantViolations, [], context);
          }
        }
      }
    }
  }
});
