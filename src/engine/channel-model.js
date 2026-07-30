import { clamp } from './math.js';
import { deterministicChance, normalNoise } from './random.js';

export function createChannelSnapshot(config, simulationTimeSeconds, frameIndex) {
  const jitterForward = normalNoise(config.seed + frameIndex * 17 + 11) * config.jitterMs;
  const jitterReturn = normalNoise(config.seed + frameIndex * 19 + 23) * config.jitterMs;
  const halfAsymmetry = config.asymmetryMs / 2;
  const forwardMs = Math.max(0.05, config.baseDelayMs + halfAsymmetry + jitterForward);
  const returnMs = Math.max(0.05, config.baseDelayMs - halfAsymmetry + jitterReturn);
  const rttMs = forwardMs + returnMs;
  const clockDriftMs = (config.clockDriftPpm * simulationTimeSeconds) / 1000;
  const clockErrorMs = config.clockOffsetMs + clockDriftMs;
  const packetAgeMs = forwardMs + Math.max(0, config.jitterMs * 0.8);
  const burstActive = deterministicChance(config.seed + frameIndex * 31, config.burstLossPct / 100);
  const frameLossProbability = clamp(
    config.packetLossPct / 100 + (burstActive ? config.burstLossPct / 100 : 0),
    0,
    0.98
  );
  const corruption = deterministicChance(config.seed + frameIndex * 37 + 5, config.corruptionPct / 100);
  const hardInvalid = corruption || packetAgeMs > config.packetAbsoluteAgeMs || frameLossProbability > 0.88;

  return {
    forwardMs,
    returnMs,
    rttMs,
    clockErrorMs,
    packetAgeMs,
    frameLossProbability,
    burstActive,
    corruption,
    hardInvalid
  };
}

export function shouldDropSample(config, channel, globalSampleIndex) {
  const baseProbability = channel.frameLossProbability;
  return deterministicChance(config.seed + globalSampleIndex * 101 + 47, baseProbability);
}

export function sampleTimingJitterMs(config, globalSampleIndex) {
  return normalNoise(config.seed + globalSampleIndex * 73 + 97) * config.jitterMs * 0.28;
}
