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

export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: 1,
  seed: 61850,
  algorithm: ALGORITHM_MODES.PING_PONG,
  scenario: ELECTRICAL_SCENARIOS.THROUGH,
  frequencyHz: 50,
  sampleRateHz: 4000,
  windowCycles: 4,
  baseDelayMs: 3,
  asymmetryMs: 0,
  jitterMs: 0.1,
  packetLossPct: 0,
  burstLossPct: 0,
  corruptionPct: 0,
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
  minProtectionValidFraction: 0.9,
  minPickupPu: 0.22,
  restraintSlope: 0.3,
  securePickupMultiplier: 1.55,
  simulationSpeed: 1
});

export const PRESETS = Object.freeze({
  normal: {
    label: 'Normal through current',
    purpose: 'Baseline: healthy channel and near-zero Idiff.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      asymmetryMs: 0,
      jitterMs: 0.08,
      packetLossPct: 0,
      burstLossPct: 0,
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
      clockOffsetMs: 0.15
    }
  },
  jitterBurst: {
    label: 'Jitter burst',
    purpose: 'Tests confidence decay, secure ride-through, and blocking.',
    patch: {
      scenario: ELECTRICAL_SCENARIOS.THROUGH,
      asymmetryMs: 1.2,
      jitterMs: 2.1,
      packetLossPct: 2,
      burstLossPct: 18,
      clockOffsetMs: 0.2
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
