import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, createDefaultConfig } from './constants.js';
import { clamp } from './math.js';

const algorithms = new Set(Object.values(ALGORITHM_MODES));
const scenarios = new Set(Object.values(ELECTRICAL_SCENARIOS));

function number(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, minimum, maximum) : fallback;
}

export function sanitizeConfig(candidate = {}) {
  const defaults = createDefaultConfig();
  const config = { ...defaults, ...candidate };
  config.schemaVersion = 1;
  config.seed = Math.max(1, Math.floor(number(config.seed, defaults.seed, 1, 2_147_483_647)));
  config.algorithm = algorithms.has(config.algorithm) ? config.algorithm : defaults.algorithm;
  config.scenario = scenarios.has(config.scenario) ? config.scenario : defaults.scenario;
  config.frequencyHz = number(config.frequencyHz, defaults.frequencyHz, 40, 70);
  config.sampleRateHz = number(config.sampleRateHz, defaults.sampleRateHz, 1000, 16000);
  config.windowCycles = number(config.windowCycles, defaults.windowCycles, 2, 8);
  config.baseDelayMs = number(config.baseDelayMs, defaults.baseDelayMs, 0.1, 20);
  config.asymmetryMs = number(config.asymmetryMs, defaults.asymmetryMs, -12, 12);
  config.jitterMs = number(config.jitterMs, defaults.jitterMs, 0, 6);
  config.packetLossPct = number(config.packetLossPct, defaults.packetLossPct, 0, 50);
  config.burstLossPct = number(config.burstLossPct, defaults.burstLossPct, 0, 80);
  config.corruptionPct = number(config.corruptionPct, defaults.corruptionPct, 0, 30);
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
  config.minPickupPu = number(config.minPickupPu, defaults.minPickupPu, 0.05, 2);
  config.restraintSlope = number(config.restraintSlope, defaults.restraintSlope, 0.05, 1);
  config.securePickupMultiplier = number(config.securePickupMultiplier, defaults.securePickupMultiplier, 1, 3);
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
