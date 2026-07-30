import { ALGORITHM_MODES } from './constants.js';
import { clamp } from './math.js';

function scoreStatus(score) {
  if (score >= 82) return 'GOOD';
  if (score >= 62) return 'DEGRADED';
  if (score >= 42) return 'LOW';
  return 'UNRELIABLE';
}

export function calculateConfidence({ config, channel, alignment, validFraction, protectionValidFraction }) {
  const observedLossFraction = clamp(1 - validFraction, 0, 1);
  const channelPenalty =
    observedLossFraction * 125 +
    (channel.rttJitterMs ?? 0) * 12 +
    (channel.rttStepMs ?? 0) * 9 +
    Math.max(0, channel.packetAgeMs - 8) * 3.5 +
    (channel.corruption ? 100 : 0);
  const channelScore = clamp(100 - channelPenalty, 0, 100);

  const tracker = alignment.tracker ?? {};
  const short = tracker.short ?? tracker;
  const stable = tracker.stable ?? tracker;
  const shortPeak = Number(short.peakScore ?? tracker.peakScore ?? 0);
  const stablePeak = Number(stable.peakScore ?? tracker.peakScore ?? 0);
  const shortCurvature = Number(short.peakCurvature ?? 0);
  const stableCurvature = Number(stable.peakCurvature ?? 0);
  const agreementMs = Number(tracker.estimatorAgreementMs ?? 0);
  const innovationMs = Math.abs(Number(tracker.trajectoryInnovationMs ?? 0));
  const measurementAccepted = tracker.measurementAccepted !== false;

  const trackerPenalty = config.algorithm === ALGORITHM_MODES.SMART_TRACKING
    ? (2 - shortPeak - stablePeak) * 18 +
      (2 - shortCurvature - stableCurvature) * 4 +
      Math.max(0, agreementMs - config.trackerAgreementMs * 0.35) * 18 +
      Math.max(0, innovationMs - config.trackerMaxSlewMs * 0.5) * 12 +
      (tracker.atSearchBoundary ? 12 : 0) +
      (!measurementAccepted ? 18 : 0) +
      (tracker.innovationClamped ? 7 : 0)
    : 0;
  const gpsPenalty = config.algorithm === ALGORITHM_MODES.GPS && !channel.timeSyncValid ? 58 : 0;
  const alignmentScore = clamp(100 - alignment.uncertaintyMs * 32 - trackerPenalty - gpsPenalty, 0, 100);

  const coherence = Math.abs(alignment.protectionCorrelation ?? alignment.trackingCorrelation ?? 0);
  const predictionPenalty = (tracker.predictedFraction ?? 0) * 55;
  const measuredCoveragePenalty = Math.max(0, 1 - protectionValidFraction) * 135;
  const waveformScore = clamp(coherence * 100 - predictionPenalty - measuredCoveragePenalty, 0, 100);

  const reasons = [];
  if (channel.corruption) reasons.push('PACKET_INTEGRITY_FAIL');
  if (channel.packetAgeMs > config.packetAbsoluteAgeMs) reasons.push('PACKET_STALE');
  if (observedLossFraction > 0.12) reasons.push('PACKET_LOSS_BURST');
  if ((channel.rttJitterMs ?? 0) > 0.6 || (channel.rttStepMs ?? 0) > 1) reasons.push('RTT_UNSTABLE');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && Math.abs(alignment.trackingCorrectionMs) > 0.45) reasons.push('RTT_ALIGNMENT_DISAGREEMENT');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && agreementMs > config.trackerAgreementMs) reasons.push('ESTIMATOR_DISAGREEMENT');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && !measurementAccepted) reasons.push('TRACKING_MEASUREMENT_HELD');
  if (
    config.algorithm === ALGORITHM_MODES.SMART_TRACKING &&
    innovationMs > Math.max(config.trackerAgreementMs * 1.5, config.trackerMaxSlewMs * 1.25)
  ) reasons.push('TRAJECTORY_INNOVATION_HIGH');
  if (alignment.uncertaintyMs > 0.45) reasons.push('ALIGNMENT_UNCERTAIN');
  if (config.algorithm === ALGORITHM_MODES.GPS && !channel.timeSyncValid) reasons.push('TIME_SYNC_INVALID');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && (tracker.ambiguity ?? 1) > 0.985 && (tracker.peakScore ?? 0) < 0.92) reasons.push('TRACKING_AMBIGUOUS');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && tracker.atSearchBoundary) reasons.push('TRACKER_AT_BOUNDARY');
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
