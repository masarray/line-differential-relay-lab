import { ALGORITHM_MODES } from './constants.js';
import { clamp } from './math.js';

function scoreStatus(score) {
  if (score >= 82) return 'GOOD';
  if (score >= 62) return 'DEGRADED';
  if (score >= 42) return 'LOW';
  return 'UNRELIABLE';
}

export function calculateConfidence({ config, channel, alignment, validFraction, electricalChange }) {
  const channelPenalty =
    Math.abs(config.asymmetryMs) * 5.2 +
    config.jitterMs * 10.5 +
    channel.frameLossProbability * 125 +
    Math.max(0, channel.packetAgeMs - 8) * 3.5 +
    (channel.burstActive ? 8 : 0) +
    (channel.corruption ? 100 : 0);
  const channelScore = clamp(100 - channelPenalty, 0, 100);

  const residualPenalty = Math.abs(alignment.residualEstimateMs) * 34;
  const trackerPenalty = config.algorithm === ALGORITHM_MODES.SMART_TRACKING
    ? (1 - alignment.tracker.peakScore) * 38 + alignment.tracker.ambiguity * 18
    : 0;
  const gpsPenalty = config.algorithm === ALGORITHM_MODES.GPS && !config.gpsSyncValid ? 58 : 0;
  const alignmentScore = clamp(100 - residualPenalty - trackerPenalty - gpsPenalty, 0, 100);

  const coherence = Math.abs(alignment.alignedCorrelation);
  const predictionPenalty = alignment.tracker.predictedFraction * 95;
  const electricalAllowance = electricalChange ? 12 : 0;
  const waveformScore = clamp(coherence * 100 - predictionPenalty + electricalAllowance, 0, 100);

  const reasons = [];
  if (channel.corruption) reasons.push('PACKET_INTEGRITY_FAIL');
  if (channel.packetAgeMs > config.packetAbsoluteAgeMs) reasons.push('PACKET_STALE');
  if (channel.frameLossProbability > 0.12) reasons.push('PACKET_LOSS_BURST');
  if (config.jitterMs > 1) reasons.push('JITTER_HIGH');
  if (Math.abs(config.asymmetryMs) > 1.5) reasons.push('PATH_ASYMMETRY');
  if (Math.abs(alignment.residualEstimateMs) > 0.45) reasons.push('ALIGNMENT_UNCERTAIN');
  if (config.algorithm === ALGORITHM_MODES.GPS && !config.gpsSyncValid) reasons.push('TIME_SYNC_INVALID');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && alignment.tracker.ambiguity > 0.9) reasons.push('TRACKING_AMBIGUOUS');
  if (validFraction < 0.92) reasons.push('REMOTE_DATA_GAPS');
  if (reasons.length === 0) reasons.push('QUALITY_NOMINAL');

  return {
    channel: { score: channelScore, status: scoreStatus(channelScore) },
    alignment: { score: alignmentScore, status: scoreStatus(alignmentScore) },
    waveform: { score: waveformScore, status: scoreStatus(waveformScore) },
    minimumScore: Math.min(channelScore, alignmentScore, waveformScore),
    hardInvalid: channel.hardInvalid,
    reasons
  };
}
