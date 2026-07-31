import {
  ALGORITHM_MODES,
  ELECTRICAL_SCENARIOS,
  SECURITY_POLICIES,
  createDefaultConfig
} from './constants.js';
import { clamp } from './math.js';

const algorithms = new Set(Object.values(ALGORITHM_MODES));
const scenarios = new Set(Object.values(ELECTRICAL_SCENARIOS));
const securityPolicies = new Set(Object.values(SECURITY_POLICIES));

function number(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, minimum, maximum) : fallback;
}

function integer(value, fallback, minimum, maximum) {
  return Math.round(number(value, fallback, minimum, maximum));
}

export function sanitizeConfig(candidate = {}) {
  const defaults = createDefaultConfig();
  const config = { ...defaults, ...candidate };
  config.schemaVersion = 1;
  config.seed = Math.max(1, Math.floor(number(config.seed, defaults.seed, 1, 2_147_483_647)));
  config.algorithm = algorithms.has(config.algorithm) ? config.algorithm : defaults.algorithm;
  config.securityPolicy = securityPolicies.has(config.securityPolicy)
    ? config.securityPolicy
    : defaults.securityPolicy;
  config.scenario = scenarios.has(config.scenario) ? config.scenario : defaults.scenario;
  config.frequencyHz = number(config.frequencyHz, defaults.frequencyHz, 40, 70);
  config.sampleRateHz = number(config.sampleRateHz, defaults.sampleRateHz, 1000, 16000);
  config.windowCycles = number(config.windowCycles, defaults.windowCycles, 2, 8);
  config.baseDelayMs = number(config.baseDelayMs, defaults.baseDelayMs, 0.1, 20);
  config.asymmetryMs = number(config.asymmetryMs, defaults.asymmetryMs, -12, 12);
  config.jitterMs = number(config.jitterMs, defaults.jitterMs, 0, 6);
  config.packetLossPct = number(config.packetLossPct, defaults.packetLossPct, 0, 50);
  config.burstLossPct = number(config.burstLossPct, defaults.burstLossPct, 0, 80);
  config.burstLengthFrames = integer(config.burstLengthFrames, defaults.burstLengthFrames, 1, 12);
  config.corruptionPct = number(config.corruptionPct, defaults.corruptionPct, 0, 30);
  config.duplicatePct = number(config.duplicatePct, defaults.duplicatePct, 0, 60);
  config.reorderPct = number(config.reorderPct, defaults.reorderPct, 0, 60);
  config.reorderExtraDelayMs = number(config.reorderExtraDelayMs, defaults.reorderExtraDelayMs, 0, 20);
  config.reorderBufferFrames = integer(config.reorderBufferFrames, defaults.reorderBufferFrames, 0, 12);
  config.packetSamples = integer(config.packetSamples, defaults.packetSamples, 2, 64);
  config.packetSerializationMs = number(config.packetSerializationMs, defaults.packetSerializationMs, 0, 5);
  config.routeChangeAtMs = number(config.routeChangeAtMs, defaults.routeChangeAtMs, 0, 10000);
  config.routeStepDeltaMs = number(config.routeStepDeltaMs, defaults.routeStepDeltaMs, -12, 12);
  config.routeRampMs = number(config.routeRampMs, defaults.routeRampMs, 0, 4000);
  config.maxConsecutiveLossFrames = integer(
    config.maxConsecutiveLossFrames,
    defaults.maxConsecutiveLossFrames,
    1,
    20
  );
  config.maxReceiverQueueFrames = integer(
    config.maxReceiverQueueFrames,
    defaults.maxReceiverQueueFrames,
    1,
    32
  );
  config.clockOffsetMs = number(config.clockOffsetMs, defaults.clockOffsetMs, -5, 5);
  config.clockDriftPpm = number(config.clockDriftPpm, defaults.clockDriftPpm, -150, 150);
  config.remoteMagnitudePct = number(config.remoteMagnitudePct, defaults.remoteMagnitudePct, 50, 150);
  config.remotePhaseDeg = number(config.remotePhaseDeg, defaults.remotePhaseDeg, -20, 20);
  config.halfWaveAsymmetryPct = number(config.halfWaveAsymmetryPct, defaults.halfWaveAsymmetryPct, 0, 35);
  config.harmonic3Pct = number(config.harmonic3Pct, defaults.harmonic3Pct, 0, 25);
  config.dcOffsetPct = number(config.dcOffsetPct, defaults.dcOffsetPct, 0, 50);
  config.ctSaturationPct = number(config.ctSaturationPct, defaults.ctSaturationPct, 0, 100);
  config.gpsSyncValid = Boolean(config.gpsSyncValid);
  config.gpsHoldover = Boolean(config.gpsHoldover);
  config.secureWindowMs = number(config.secureWindowMs, defaults.secureWindowMs, 20, 500);
  config.recoveryValidationMs = number(config.recoveryValidationMs, defaults.recoveryValidationMs, 40, 1000);
  config.packetAbsoluteAgeMs = number(config.packetAbsoluteAgeMs, defaults.packetAbsoluteAgeMs, 4, 100);
  config.trackWindowMs = number(config.trackWindowMs, defaults.trackWindowMs, 0.2, 8);
  config.trackerMaxSlewMs = number(config.trackerMaxSlewMs, defaults.trackerMaxSlewMs, 0.05, 2);
  config.trackerShortWindowCycles = number(config.trackerShortWindowCycles, defaults.trackerShortWindowCycles, 0.25, 1.5);
  config.trackerStabilityWindowCycles = number(config.trackerStabilityWindowCycles, defaults.trackerStabilityWindowCycles, 1, 4);
  config.trackerAgreementMs = number(config.trackerAgreementMs, defaults.trackerAgreementMs, 0.1, 2);
  config.trackerAlpha = number(config.trackerAlpha, defaults.trackerAlpha, 0.05, 1);
  config.trackerBeta = number(config.trackerBeta, defaults.trackerBeta, 0, 0.5);
  config.trackerVelocityDamping = number(config.trackerVelocityDamping, defaults.trackerVelocityDamping, 0, 0.95);
  config.trackerMaxVelocityMs = number(config.trackerMaxVelocityMs, defaults.trackerMaxVelocityMs, 0.02, 1);
  config.minProtectionValidFraction = number(config.minProtectionValidFraction, defaults.minProtectionValidFraction, 0.5, 1);
  config.minPickupPu = number(config.minPickupPu, defaults.minPickupPu, 0.05, 2);
  config.restraintSlope = number(config.restraintSlope, defaults.restraintSlope, 0.05, 1);
  config.securePickupMultiplier = number(config.securePickupMultiplier, defaults.securePickupMultiplier, 1, 3);
  config.degradedRecoveryMs = number(config.degradedRecoveryMs, defaults.degradedRecoveryMs, 20, 500);
  config.degradedMinChannelScore = number(config.degradedMinChannelScore, defaults.degradedMinChannelScore, 42, 90);
  config.degradedMinAlignmentScore = number(config.degradedMinAlignmentScore, defaults.degradedMinAlignmentScore, 42, 90);
  config.degradedMinWaveformScore = number(config.degradedMinWaveformScore, defaults.degradedMinWaveformScore, 42, 90);
  config.degradedMaxUncertaintyMs = number(config.degradedMaxUncertaintyMs, defaults.degradedMaxUncertaintyMs, 0.2, 2.5);
  config.degradedMaxPredictedFraction = number(
    config.degradedMaxPredictedFraction,
    defaults.degradedMaxPredictedFraction,
    0,
    0.35
  );
  config.degradedMaxCorrectionAgeMs = number(
    config.degradedMaxCorrectionAgeMs,
    defaults.degradedMaxCorrectionAgeMs,
    20,
    1000
  );
  config.secureMaxCorrectionAgeMs = number(
    config.secureMaxCorrectionAgeMs,
    defaults.secureMaxCorrectionAgeMs,
    config.degradedMaxCorrectionAgeMs,
    2000
  );
  config.maxElectricalHoldAgeMs = number(
    config.maxElectricalHoldAgeMs,
    defaults.maxElectricalHoldAgeMs,
    20,
    500
  );
  config.strongEvidenceMaxCorrectionAgeMs = number(
    config.strongEvidenceMaxCorrectionAgeMs,
    defaults.strongEvidenceMaxCorrectionAgeMs,
    10,
    config.degradedMaxCorrectionAgeMs
  );
  config.degradedPickupMultiplier = number(config.degradedPickupMultiplier, defaults.degradedPickupMultiplier, 1.05, 2.5);
  config.degradedPersistenceMs = number(config.degradedPersistenceMs, defaults.degradedPersistenceMs, 20, 200);
  config.degradedMinFaultEvidence = number(config.degradedMinFaultEvidence, defaults.degradedMinFaultEvidence, 0.5, 0.98);
  config.degradedMinDirectionCorrelation = number(
    config.degradedMinDirectionCorrelation,
    defaults.degradedMinDirectionCorrelation,
    0,
    0.8
  );
  config.simulationSpeed = number(config.simulationSpeed, defaults.simulationSpeed, 0.1, 4);
  return config;
}

export function createExperimentDocument(config) {
  return {
    format: 'line-differential-relay-lab-experiment',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    config: sanitizeConfig(config)
  };
}

export function parseExperimentDocument(document) {
  if (!document || document.format !== 'line-differential-relay-lab-experiment') {
    throw new Error('Unsupported experiment file.');
  }
  if (document.schemaVersion !== 1) {
    throw new Error(`Unsupported experiment schema version: ${document.schemaVersion}`);
  }
  return sanitizeConfig(document.config);
}
