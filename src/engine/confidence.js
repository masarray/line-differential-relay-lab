import { ALGORITHM_MODES } from './constants.js';
import { clamp } from './math.js';

function scoreStatus(score) {
  if (score >= 82) return 'GOOD';
  if (score >= 62) return 'DEGRADED';
  if (score >= 42) return 'LOW';
  return 'UNRELIABLE';
}

export function calculateConfidence({ config, channel, alignment, validFraction, protectionValidFraction }) {
  const observedLossFraction = clamp(channel.observedLossFraction ?? (1 - validFraction), 0, 1);
  const sequenceGapCount = Number(channel.sequenceGapCount ?? 0);
  const consecutiveLoss = Number(channel.maxConsecutiveLossFrames ?? 0);
  const duplicateFrames = Number(channel.duplicateFrames ?? 0);
  const reorderedFrames = Number(channel.reorderedFrames ?? 0);
  const lateFrames = Number(channel.lateFrames ?? 0);
  const queueDepth = Number(channel.queueDepthFrames ?? 0);
  const queueOverflowFrames = Number(channel.queueOverflowFrames ?? 0);

  const channelPenalty =
    observedLossFraction * 115 +
    (channel.rttJitterMs ?? 0) * 12 +
    (channel.rttStepMs ?? 0) * 9 +
    Math.max(0, channel.packetAgeMs - 8) * 3.5 +
    sequenceGapCount * 4 +
    consecutiveLoss * 7 +
    duplicateFrames * 0.7 +
    reorderedFrames * 1.8 +
    lateFrames * 10 +
    Math.max(0, queueDepth - 1) * 2.5 +
    queueOverflowFrames * 18 +
    (channel.routeTransitionActive ? 7 : 0) +
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
  const electricalHold = tracker.electricalHold === true;

  const trackerPenalty = config.algorithm === ALGORITHM_MODES.SMART_TRACKING
    ? (2 - shortPeak - stablePeak) * 18 +
      (2 - shortCurvature - stableCurvature) * 4 +
      Math.max(0, agreementMs - config.trackerAgreementMs * 0.35) * 18 +
      Math.max(0, innovationMs - config.trackerMaxSlewMs * 0.5) * 12 +
      (tracker.atSearchBoundary && !electricalHold ? 12 : 0) +
      (!measurementAccepted && !electricalHold ? 18 : 0) +
      (tracker.innovationClamped ? 7 : 0)
    : 0;
  const gpsPenalty = config.algorithm === ALGORITHM_MODES.GPS && !channel.timeSyncValid ? 58 : 0;
  const rawAlignmentScore = clamp(100 - alignment.uncertaintyMs * 32 - trackerPenalty - gpsPenalty, 0, 100);

  const coherence = Math.abs(alignment.protectionCorrelation ?? alignment.trackingCorrelation ?? 0);
  const predictionPenalty = (tracker.predictedFraction ?? 0) * 55;
  const measuredCoveragePenalty = Math.max(0, 1 - protectionValidFraction) * 135;
  const waveformScore = clamp(coherence * 100 - predictionPenalty - measuredCoveragePenalty, 0, 100);

  const trustedElectricalHold =
    electricalHold &&
    channelScore >= 82 &&
    waveformScore >= 82 &&
    protectionValidFraction >= 0.9 &&
    sequenceGapCount === 0 &&
    consecutiveLoss === 0 &&
    lateFrames === 0 &&
    queueOverflowFrames === 0;
  const alignmentScore = trustedElectricalHold
    ? Math.max(rawAlignmentScore, 84)
    : rawAlignmentScore;

  const reasons = [];
  if (channel.corruption) reasons.push('PACKET_INTEGRITY_FAIL');
  if (queueOverflowFrames > 0) reasons.push('RECEIVER_QUEUE_OVERFLOW');
  if (lateFrames > 0) reasons.push('REORDER_BUFFER_EXCEEDED');
  if (consecutiveLoss > config.maxConsecutiveLossFrames) reasons.push('CONSECUTIVE_FRAME_LOSS');
  if (channel.packetAgeMs > config.packetAbsoluteAgeMs) reasons.push('PACKET_STALE');
  if (sequenceGapCount > 0) reasons.push('PACKET_SEQUENCE_GAP');
  if (observedLossFraction > 0.12) reasons.push('PACKET_LOSS_BURST');
  if (reorderedFrames > 0) reasons.push('PACKET_REORDERED');
  if (duplicateFrames > 0) reasons.push('DUPLICATE_FRAME_DISCARDED');
  if (channel.routeTransitionActive) reasons.push('ROUTE_TRANSITION');
  if ((channel.rttJitterMs ?? 0) > 0.6 || (channel.rttStepMs ?? 0) > 1) reasons.push('RTT_UNSTABLE');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && electricalHold) {
    reasons.push(trustedElectricalHold ? 'ELECTRICAL_TRANSIENT_HOLD' : 'ELECTRICAL_HOLD_UNTRUSTED');
  }
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && Math.abs(alignment.trackingCorrectionMs) > 0.45) {
    reasons.push('RTT_ALIGNMENT_DISAGREEMENT');
  }
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && agreementMs > config.trackerAgreementMs && !electricalHold) {
    reasons.push('ESTIMATOR_DISAGREEMENT');
  }
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && !measurementAccepted && !electricalHold) {
    reasons.push('TRACKING_MEASUREMENT_HELD');
  }
  if (
    config.algorithm === ALGORITHM_MODES.SMART_TRACKING &&
    innovationMs > Math.max(config.trackerAgreementMs * 1.5, config.trackerMaxSlewMs * 1.25)
  ) reasons.push('TRAJECTORY_INNOVATION_HIGH');
  if (alignment.uncertaintyMs > 0.45 && !trustedElectricalHold) reasons.push('ALIGNMENT_UNCERTAIN');
  if (config.algorithm === ALGORITHM_MODES.GPS && !channel.timeSyncValid) reasons.push('TIME_SYNC_INVALID');
  if (
    config.algorithm === ALGORITHM_MODES.SMART_TRACKING &&
    (tracker.ambiguity ?? 1) > 0.985 &&
    (tracker.peakScore ?? 0) < 0.92 &&
    !electricalHold
  ) reasons.push('TRACKING_AMBIGUOUS');
  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING && tracker.atSearchBoundary && !electricalHold) {
    reasons.push('TRACKER_AT_BOUNDARY');
  }
  if (protectionValidFraction < config.minProtectionValidFraction) reasons.push('INSUFFICIENT_MEASURED_DATA');
  if (validFraction < 0.92) reasons.push('REMOTE_DATA_GAPS');
  if (channelScore < 42) reasons.push('CHANNEL_UNRELIABLE');
  if (reasons.length === 0) reasons.push('QUALITY_NOMINAL');

  const hardInvalid = Boolean(
    channel.hardInvalid ||
    channelScore < 42 ||
    protectionValidFraction < 0.25
  );
  return {
    channel: { score: channelScore, status: scoreStatus(channelScore) },
    alignment: { score: alignmentScore, status: scoreStatus(alignmentScore) },
    waveform: { score: waveformScore, status: scoreStatus(waveformScore) },
    minimumScore: Math.min(channelScore, alignmentScore, waveformScore),
    hardInvalid,
    trustedElectricalHold,
    reasons
  };
}
