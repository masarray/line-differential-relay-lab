import { ALGORITHM_MODES } from './constants.js';
import { clamp } from './math.js';

function scoreStatus(score) {
  if (score >= 82) return 'GOOD';
  if (score >= 62) return 'DEGRADED';
  if (score >= 42) return 'LOW';
  return 'UNRELIABLE';
}

/**
 * Confidence is calculated only from receiver-observable communication data,
 * estimator evidence, and measured-sample coverage. Plant truth and scenario
 * names are intentionally excluded.
 */
export function calculateConfidence({
  config,
  channel,
  alignment,
  validFraction,
  protectionValidFraction
}) {
  const observedLossFraction = clamp(1 - validFraction, 0, 1);
  const channelPenalty =
    observedLossFraction * 125 +
    (channel.rttJitterMs ?? 0) * 12 +
    (channel.rttStepMs ?? 0) * 9 +
    Math.max(0, channel.packetAgeMs - 8) * 3.5 +
    (channel.corruption ? 100 : 0);
  const channelScore = clamp(100 - channelPenalty, 0, 100);

  const trackerPenalty = config.algorithm === ALGORITHM_MODES.SMART_TRACKING
    ? (1 - alignment.tracker.peakScore) * 30 +
      alignment.tracker.ambiguity * (1 - alignment.tracker.peakScore) * 24 +
      (alignment.tracker.atSearchBoundary ? 12 : 0)
    : 0;
  const gpsPenalty = config.algorithm === ALGORITHM_MODES.GPS && !channel.timeSyncValid ? 58 : 0;
  const alignmentScore = clamp(100 - alignment.uncertaintyMs * 32 - trackerPenalty - gpsPenalty, 0, 100);

  const coherence = Math.abs(alignment.protectionCorrelation ?? alignment.trackingCorrelation ?? 0);
  const predictionPenalty = alignment.tracker.predictedFraction * 55;
  const measuredCoveragePenalty = Math.max(0, 1 - protectionValidFraction) * 135;
  const waveformScore = clamp(coherence * 100 - predictionPenalty - measuredCoveragePenalty, 0, 100);

  const reasons = [];
  if (channel.corruption) reasons.push('PACKET_INTEGRITY_FAIL');
  if (channel.packetAgeMs > config.packetAbsoluteAgeMs) reasons.push('PACKET_STALE');
  if (observedLossFraction > 0.12) reasons.push('PACKET_LOSS_BURST');
  if ((channel.rttJitterMs ?? 0) > 0.6 || (channel.rttStepMs ?? 0) > 1) reasons.push('RTT_UNSTABLE');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && Math.abs(alignment.trackingCorrectionMs) > 0.45) {
    reasons.push('RTT_ALIGNMENT_DISAGREEMENT');
  }
  if (alignment.uncertaintyMs > 0.45) reasons.push('ALIGNMENT_UNCERTAIN');
  if (config.algorithm === ALGORITHM_MODES.GPS && !channel.timeSyncValid) reasons.push('TIME_SYNC_INVALID');
  if (
    config.algorithm === ALGORITHM_MODES.SMART_TRACKING &&
    alignment.tracker.ambiguity > 0.985 &&
    alignment.tracker.peakScore < 0.92
  ) reasons.push('TRACKING_AMBIGUOUS');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && alignment.tracker.atSearchBoundary) {
    reasons.push('TRACKER_AT_BOUNDARY');
  }
  if (protectionValidFraction < config.minProtectionValidFraction) reasons.push('INSUFFICIENT_MEASURED_DATA');
  if (validFraction < 0.92) reasons.push('REMOTE_DATA_GAPS');
  if (reasons.length === 0) reasons.push('QUALITY_NOMINAL');

  const hardInvalid = Boolean(channel.hardInvalid || protectionValidFraction < 0.25);

  return {
    channel: { score: channelScore, status: scoreStatus(channelScore) },
    alignment: { score: alignmentScore, status: scoreStatus(alignmentScore) },
    waveform: { score: waveformScore, status: scoreStatus(waveformScore) },
    minimumScore: Math.min(channelScore, alignmentScore, waveformScore),
    hardInvalid,
    reasons
  };
}
