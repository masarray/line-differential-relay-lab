export const ALGORITHM_MODES = Object.freeze({
  PING_PONG: 'ping-pong',
  SECURE_WINDOW: 'secure-window',
  GPS: 'gps',
  SMART_TRACKING: 'smart-tracking'
});

export const ELECTRICAL_SCENARIOS = Object.freeze({
  THROUGH: 'through-current',
  LOAD_STEP: 'load-step',
  EXTERNAL_FAULT: 'external-fault',
  INTERNAL_FAULT: 'internal-fault',
  CT_ERROR: 'ct-error'
});

export const PROTECTION_STATES = Object.freeze({
  NORMAL: 'NORMAL',
  WATCH: 'WATCH',
  SECURE: 'SECURE WINDOW',
  BLOCKED: 'BLOCKED',
  RECOVERY: 'RECOVERY VALIDATION'
});

export const SECURITY_POLICIES = Object.freeze({
  COMMUNICATION_SUPERVISED: 'communication-supervised',
  COMMUNICATION_ONLY_SUPERVISED: 'communication-only-supervised',
  FIXED_OBSERVATION_WINDOW: 'fixed-observation-window'
});

export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: 1,
  seed: 61850,
  algorithm: ALGORITHM_MODES.PING_PONG,
  securityPolicy: SECURITY_POLICIES.COMMUNICATION_SUPERVISED,
  scenario: ELECTRICAL_SCENARIOS.THROUGH,
  frequencyHz: 50,
  sampleRateHz: 4000,
  windowCycles: 4,
  baseDelayMs: 3,
  asymmetryMs: 0,
  jitterMs: 0.1,
  packetLossPct: 0,
  burstLossPct: 0,
  burstLengthFrames: 3,
  corruptionPct: 0,
  duplicatePct: 0,
  reorderPct: 0,
  reorderExtraDelayMs: 3,
  reorderBufferFrames: 2,
  packetSamples: 8,
  packetSerializationMs: 0.12,
  routeChangeAtMs: 800,
  routeStepDeltaMs: 0,
  routeRampMs: 0,
  maxConsecutiveLossFrames: 3,
  maxReceiverQueueFrames: 8,
  clockOffsetMs: 0,
  clockDriftPpm: 5,
  remoteMagnitudePct: 100,
  remotePhaseDeg: 0,
  halfWaveAsymmetryPct: 0,
  harmonic3Pct: 0,
  dcOffsetPct: 0,
  ctSaturationPct: 0,
  gpsSyncValid: true,
  gpsHoldover: false,
  secureWindowMs: 120,
  recoveryValidationMs: 180,
  packetAbsoluteAgeMs: 18,
  trackWindowMs: 2.5,
  trackerMaxSlewMs: 0.45,
  trackerShortWindowCycles: 0.65,
  trackerStabilityWindowCycles: 2.2,
  trackerAgreementMs: 0.55,
  trackerAlpha: 0.58,
  trackerBeta: 0.12,
  trackerVelocityDamping: 0.35,
  trackerMaxVelocityMs: 0.25,
  minProtectionValidFraction: 0.9,
  minPickupPu: 0.22,
  restraintSlope: 0.3,
  securePickupMultiplier: 1.55,
  simulationSpeed: 1
});

export const PRESETS = Object.freeze({
  normal: {
    label: 'Normal through current',
    purpose: 'Baseline: healthy packet stream and near-zero Idiff.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      asymmetryMs: 0,
      jitterMs: 0.08,
      packetLossPct: 0,
      burstLossPct: 0,
      duplicatePct: 0,
      reorderPct: 0,
      routeStepDeltaMs: 0,
      clockOffsetMs: 0,
      clockDriftPpm: 3,
      remoteMagnitudePct: 100,
      halfWaveAsymmetryPct: 0,
      gpsSyncValid: true
    }
  },
  asymmetricRoute: {
    label: 'Asymmetric route',
    purpose: 'Shows RTT/2 residual error and false differential current.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      asymmetryMs: 4.2,
      jitterMs: 0.35,
      packetLossPct: 0.5,
      duplicatePct: 0,
      reorderPct: 0,
      routeStepDeltaMs: 0,
      clockOffsetMs: 0.15
    }
  },
  jitterBurst: {
    label: 'Jitter and burst loss',
    purpose: 'Tests packet gaps, confidence decay, secure ride-through, and blocking.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      asymmetryMs: 1.2,
      jitterMs: 2.1,
      packetLossPct: 2,
      burstLossPct: 12,
      burstLengthFrames: 3,
      duplicatePct: 0,
      reorderPct: 0,
      routeStepDeltaMs: 0,
      clockOffsetMs: 0.2
    }
  },
  packetDisorder: {
    label: 'Duplicate + reorder',
    purpose: 'Exercises sequence supervision and bounded receiver reordering.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      jitterMs: 0.35,
      packetLossPct: 0,
      burstLossPct: 0,
      duplicatePct: 18,
      reorderPct: 24,
      reorderExtraDelayMs: 4,
      reorderBufferFrames: 2,
      routeStepDeltaMs: 0
    }
  },
  routeSwitch: {
    label: 'Packet route switch',
    purpose: 'Applies a deterministic one-way route step during the experiment.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      jitterMs: 0.25,
      packetLossPct: 0,
      burstLossPct: 0,
      duplicatePct: 0,
      reorderPct: 4,
      routeChangeAtMs: 600,
      routeStepDeltaMs: 4,
      routeRampMs: 0
    }
  },
  syncLost: {
    label: 'GPS sync lost',
    purpose: 'Demonstrates timestamp-quality failure and fallback security.',
    patch: {
      algorithm: ALGORITHM_MODES.GPS,
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      gpsSyncValid: false,
      gpsHoldover: true,
      clockOffsetMs: 1.4,
      clockDriftPpm: 85,
      jitterMs: 0.7
    }
  },
  internalFaultDegraded: {
    label: 'Internal fault + degraded channel',
    purpose: 'Tests dependability without allowing invalid remote evidence.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.INTERNAL_FAULT,
      asymmetryMs: 2.2,
      jitterMs: 1.1,
      packetLossPct: 2,
      burstLossPct: 4,
      duplicatePct: 2,
      reorderPct: 4,
      clockOffsetMs: 0.35
    }
  },
  ctError: {
    label: 'CT / waveform asymmetry',
    purpose: 'Separates electrical measurement error from communication error.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.CT_ERROR,
      remoteMagnitudePct: 88,
      remotePhaseDeg: 4,
      halfWaveAsymmetryPct: 12,
      harmonic3Pct: 5,
      jitterMs: 0.15
    }
  }
});

export function createDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
