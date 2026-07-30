import { ELECTRICAL_SCENARIOS } from './constants.js';
import { clamp } from './math.js';

function saturation(value, amount) {
  if (amount <= 0) return value;
  const drive = 1 + amount * 7;
  return Math.tanh(value * drive) / Math.tanh(drive);
}

function baseWave(timeSeconds, frequencyHz, phaseRadians, config) {
  const angle = 2 * Math.PI * frequencyHz * timeSeconds + phaseRadians;
  const fundamental = Math.sin(angle);
  const third = (config.harmonic3Pct / 100) * Math.sin(3 * angle + 0.18);
  const dc = (config.dcOffsetPct / 100) * Math.exp(-Math.max(0, timeSeconds % 0.12) / 0.045);
  const asymmetry = fundamental >= 0 ? 1 + config.halfWaveAsymmetryPct / 100 : 1 - config.halfWaveAsymmetryPct / 100;
  return fundamental * asymmetry + third + dc;
}

export function terminalCurrentAt(timeSeconds, terminal, config) {
  const phaseRadians = (config.remotePhaseDeg * Math.PI) / 180;
  const remoteScale = config.remoteMagnitudePct / 100;
  let localMagnitude = 1;
  let remoteMagnitude = remoteScale;
  let remoteDirection = -1;

  switch (config.scenario) {
    case ELECTRICAL_SCENARIOS.LOAD_STEP: {
      const step = 0.72 + 0.38 * (0.5 + 0.5 * Math.tanh(Math.sin(timeSeconds * Math.PI * 0.8) * 5));
      localMagnitude = step;
      remoteMagnitude = step * remoteScale;
      break;
    }
    case ELECTRICAL_SCENARIOS.EXTERNAL_FAULT:
      localMagnitude = 3.6;
      remoteMagnitude = 3.6 * remoteScale;
      break;
    case ELECTRICAL_SCENARIOS.INTERNAL_FAULT:
      localMagnitude = 1.45;
      remoteMagnitude = 1.2 * remoteScale;
      remoteDirection = 1;
      break;
    case ELECTRICAL_SCENARIOS.CT_ERROR:
      localMagnitude = 1.25;
      remoteMagnitude = 1.25 * remoteScale;
      break;
    default:
      break;
  }

  const isRemote = terminal === 'remote';
  const magnitude = isRemote ? remoteMagnitude : localMagnitude;
  const direction = isRemote ? remoteDirection : 1;
  const phase = isRemote ? phaseRadians : 0;
  const current = direction * magnitude * baseWave(timeSeconds, config.frequencyHz, phase, config);

  if (config.scenario === ELECTRICAL_SCENARIOS.EXTERNAL_FAULT && isRemote) {
    return saturation(current, clamp(config.ctSaturationPct / 100, 0, 1));
  }
  return current;
}
