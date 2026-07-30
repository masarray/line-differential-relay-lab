import { ALGORITHM_MODES } from './constants.js';
import { clamp, estimateLag, fillSmallGaps, normalizedCorrelation, shiftSeries } from './math.js';

function receiverChannelView(channel, algorithm) {
  const view = {
    rttMs: Number(channel.rttMs),
    rttStepMs: Number(channel.rttStepMs ?? 0),
    rttJitterMs: Number(channel.rttJitterMs ?? 0),
    packetAgeMs: Number(channel.packetAgeMs ?? 0),
    corruption: Boolean(channel.corruption),
    hardInvalid: Boolean(channel.hardInvalid),
    timeSyncValid: Boolean(channel.timeSyncValid)
  };
  if (algorithm === ALGORITHM_MODES.GPS) {
    view.absoluteTimeShiftMs = Number(channel.absoluteTimeShiftMs);
    view.timeReferenceUncertaintyMs = Number(channel.timeReferenceUncertaintyMs ?? 0.05);
  }
  return view;
}

function correlationTimingUncertaintyMs(correlation, frequencyHz) {
  const coherence = clamp(Math.abs(correlation), 0, 1);
  const phaseRadians = Math.acos(coherence);
  return (phaseRadians / (2 * Math.PI * frequencyHz)) * 1000;
}

function normalizeTrackerState(state) {
  if (typeof state === 'number') {
    return {
      initialized: true,
      correctionMs: Number.isFinite(state) ? state : 0,
      velocityMs: 0,
      heldFrames: 0
    };
  }
  return {
    initialized: Boolean(state?.initialized),
    correctionMs: Number.isFinite(state?.correctionMs) ? state.correctionMs : 0,
    velocityMs: Number.isFinite(state?.velocityMs) ? state.velocityMs : 0,
    heldFrames: Number.isFinite(state?.heldFrames) ? state.heldFrames : 0
  };
}

function estimatorQuality(estimate) {
  const peak = clamp(estimate.peakScore, 0, 1);
  const curvature = clamp(estimate.peakCurvature ?? 0, 0, 1);
  const uniqueness = clamp(1 - (estimate.ambiguity ?? 1), 0, 1);
  return clamp(peak * 0.68 + curvature * 0.2 + uniqueness * 0.12, 0, 1);
}

function fuseEstimators({ shortEstimate, stableEstimate, config, channel }) {
  const samplesPerMs = config.sampleRateHz / 1000;
  const shortCorrectionMs = (shortEstimate.refinedLagSamples ?? shortEstimate.lagSamples) / samplesPerMs;
  const stableCorrectionMs = (stableEstimate.refinedLagSamples ?? stableEstimate.lagSamples) / samplesPerMs;
  const agreementMs = Math.abs(shortCorrectionMs - stableCorrectionMs);
  const signConsistent = Math.sign(shortEstimate.correlation || 0) === Math.sign(stableEstimate.correlation || 0);
  const shortQuality = estimatorQuality(shortEstimate);
  const stableQuality = estimatorQuality(stableEstimate);
  const agreed = agreementMs <= config.trackerAgreementMs && signConsistent;

  let requestedCorrectionMs;
  let measurementAccepted = true;
  let source = 'FUSED';

  if (agreed) {
    const dynamicBias = clamp((channel.rttStepMs ?? 0) / Math.max(config.trackerAgreementMs, 1e-6), 0, 1);
    const shortBias = 0.42 + dynamicBias * 0.2;
    const shortWeight = Math.max(0.05, shortQuality * shortBias);
    const stableWeight = Math.max(0.05, stableQuality * (1 - shortBias));
    requestedCorrectionMs =
      (shortCorrectionMs * shortWeight + stableCorrectionMs * stableWeight) /
      (shortWeight + stableWeight);
  } else if (stableQuality > shortQuality + 0.16 && stableEstimate.peakScore >= 0.82) {
    requestedCorrectionMs = stableCorrectionMs;
    source = 'STABILITY';
  } else if (
    shortQuality > stableQuality + 0.25 &&
    shortEstimate.peakScore >= 0.9 &&
    (channel.rttStepMs ?? 0) >= config.trackerAgreementMs
  ) {
    requestedCorrectionMs = shortCorrectionMs;
    source = 'SHORT';
  } else {
    requestedCorrectionMs = Number.NaN;
    measurementAccepted = false;
    source = 'HOLD';
  }

  return {
    shortCorrectionMs,
    stableCorrectionMs,
    shortQuality,
    stableQuality,
    agreementMs,
    signConsistent,
    agreed,
    requestedCorrectionMs,
    measurementAccepted,
    source
  };
}

function updateTrajectory({ previousState, fusion, config }) {
  const state = normalizeTrackerState(previousState);
  const predictedCorrectionMs = clamp(
    state.correctionMs + state.velocityMs,
    -config.trackWindowMs,
    config.trackWindowMs
  );

  if (!fusion.measurementAccepted || !Number.isFinite(fusion.requestedCorrectionMs)) {
    const velocityMs = state.velocityMs * (1 - config.trackerVelocityDamping);
    return {
      state: {
        initialized: state.initialized,
        correctionMs: predictedCorrectionMs,
        velocityMs,
        heldFrames: state.heldFrames + 1
      },
      predictedCorrectionMs,
      acceptedCorrectionMs: predictedCorrectionMs,
      innovationMs: 0,
      innovationClamped: false,
      measurementAccepted: false
    };
  }

  const innovationMs = fusion.requestedCorrectionMs - predictedCorrectionMs;
  const innovationGateMs = Math.max(
    config.trackerAgreementMs * 1.5,
    config.trackerMaxSlewMs * 1.25
  );
  const gatedInnovationMs = clamp(innovationMs, -innovationGateMs, innovationGateMs);
  const innovationClamped = Math.abs(gatedInnovationMs - innovationMs) > 1e-9;
  const alpha = fusion.agreed ? config.trackerAlpha : config.trackerAlpha * 0.35;
  const beta = fusion.agreed ? config.trackerBeta : config.trackerBeta * 0.2;
  const filteredTargetMs = predictedCorrectionMs + alpha * gatedInnovationMs;
  const lowerSlew = state.correctionMs - config.trackerMaxSlewMs;
  const upperSlew = state.correctionMs + config.trackerMaxSlewMs;
  const acceptedCorrectionMs = clamp(
    clamp(filteredTargetMs, lowerSlew, upperSlew),
    -config.trackWindowMs,
    config.trackWindowMs
  );
  const velocityMs = clamp(
    state.velocityMs * (1 - config.trackerVelocityDamping) + beta * gatedInnovationMs,
    -config.trackerMaxVelocityMs,
    config.trackerMaxVelocityMs
  );

  return {
    state: {
      initialized: true,
      correctionMs: acceptedCorrectionMs,
      velocityMs,
      heldFrames: 0
    },
    predictedCorrectionMs,
    acceptedCorrectionMs,
    innovationMs,
    innovationClamped,
    measurementAccepted: true
  };
}

function estimateBlindUncertaintyMs({ config, channel, tracker, trackingCorrelation }) {
  const sampleResolutionMs = 500 / config.sampleRateHz;
  const rttInstabilityMs = (channel.rttStepMs ?? 0) * 0.35 + (channel.rttJitterMs ?? 0) * 0.5;

  if (config.algorithm === ALGORITHM_MODES.GPS) {
    return sampleResolutionMs + (channel.timeReferenceUncertaintyMs ?? 0.05);
  }

  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING) {
    const shortDeficitMs = (1 - tracker.short.peakScore) * config.trackWindowMs * 0.45;
    const stableDeficitMs = (1 - tracker.stable.peakScore) * config.trackWindowMs * 0.65;
    const agreementMs = Math.min(tracker.estimatorAgreementMs, config.trackWindowMs);
    const innovationMs = Math.min(Math.abs(tracker.trajectoryInnovationMs), config.trackWindowMs);
    const curvaturePenaltyMs =
      (2 - tracker.short.peakCurvature - tracker.stable.peakCurvature) * sampleResolutionMs;
    const predictionMs = tracker.predictedFraction * config.trackWindowMs;
    const holdMs = tracker.measurementAccepted ? 0 : config.trackerAgreementMs;
    return sampleResolutionMs + shortDeficitMs + stableDeficitMs + agreementMs * 0.45 +
      innovationMs * 0.35 + curvaturePenaltyMs + predictionMs + holdMs + rttInstabilityMs;
  }

  return sampleResolutionMs + correlationTimingUncertaintyMs(trackingCorrelation, config.frequencyHz) + rttInstabilityMs;
}

/**
 * Aligns remote current using only information available to the algorithm under
 * test. Ground-truth path delay is intentionally absent from the receiver view.
 */
export function alignRemote({
  local,
  remoteReceived,
  config,
  channel,
  previousTrackingMs = 0,
  trackerState = previousTrackingMs
}) {
  const receiverChannel = receiverChannelView(channel, config.algorithm);
  const samplesPerMs = config.sampleRateHz / 1000;
  const samplesPerCycle = config.sampleRateHz / config.frequencyHz;
  const pingPongEstimateMs = receiverChannel.rttMs / 2;
  let estimatedShiftMs = pingPongEstimateMs;
  let trackingCorrectionMs = 0;
  let nextTrackerState = normalizeTrackerState(trackerState);
  let tracker = {
    peakScore: 0,
    ambiguity: 1,
    correlation: 0,
    predictedFraction: 0,
    requestedCorrectionMs: 0,
    acceptedCorrectionMs: 0,
    atSearchBoundary: false,
    estimatorAgreementMs: 0,
    trajectoryInnovationMs: 0,
    measurementAccepted: true,
    innovationClamped: false,
    source: 'RTT',
    short: { peakScore: 0, ambiguity: 1, peakCurvature: 0, lagSamples: 0, correlation: 0 },
    stable: { peakScore: 0, ambiguity: 1, peakCurvature: 0, lagSamples: 0, correlation: 0 }
  };

  const maxGapSamples = Math.max(1, Math.round(config.sampleRateHz / config.frequencyHz / 10));
  const gapFilled = fillSmallGaps(remoteReceived, maxGapSamples);
  const trackingRemote = gapFilled.values;
  tracker.predictedFraction = gapFilled.predictedCount / Math.max(1, remoteReceived.length);

  if (config.algorithm === ALGORITHM_MODES.GPS) {
    estimatedShiftMs = receiverChannel.timeSyncValid && Number.isFinite(receiverChannel.absoluteTimeShiftMs)
      ? receiverChannel.absoluteTimeShiftMs
      : pingPongEstimateMs;
  }

  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING) {
    const coarseAligned = shiftSeries(trackingRemote, pingPongEstimateMs * samplesPerMs);
    const maximumLagSamples = Math.max(1, Math.round(config.trackWindowMs * samplesPerMs));
    const shortStart = Math.max(0, local.length - Math.round(samplesPerCycle * config.trackerShortWindowCycles));
    const stableStart = Math.max(0, local.length - Math.round(samplesPerCycle * config.trackerStabilityWindowCycles));
    const shortEstimate = estimateLag(local, coarseAligned, maximumLagSamples, shortStart);
    const stableEstimate = estimateLag(local, coarseAligned, maximumLagSamples, stableStart);
    const fusion = fuseEstimators({ shortEstimate, stableEstimate, config, channel: receiverChannel });
    const trajectory = updateTrajectory({ previousState: trackerState, fusion, config });

    trackingCorrectionMs = trajectory.acceptedCorrectionMs;
    nextTrackerState = trajectory.state;
    estimatedShiftMs = pingPongEstimateMs + trackingCorrectionMs;
    tracker = {
      ...tracker,
      peakScore: Math.min(shortEstimate.peakScore, stableEstimate.peakScore),
      ambiguity: Math.max(shortEstimate.ambiguity, stableEstimate.ambiguity),
      correlation: stableEstimate.correlation,
      predictedFraction: gapFilled.predictedCount / Math.max(1, remoteReceived.length),
      requestedCorrectionMs: Number.isFinite(fusion.requestedCorrectionMs)
        ? fusion.requestedCorrectionMs
        : trajectory.predictedCorrectionMs,
      acceptedCorrectionMs: trackingCorrectionMs,
      atSearchBoundary:
        Math.abs(shortEstimate.integerLagSamples) >= maximumLagSamples ||
        Math.abs(stableEstimate.integerLagSamples) >= maximumLagSamples,
      estimatorAgreementMs: fusion.agreementMs,
      trajectoryInnovationMs: trajectory.innovationMs,
      measurementAccepted: trajectory.measurementAccepted,
      innovationClamped: trajectory.innovationClamped,
      source: fusion.source,
      short: shortEstimate,
      stable: stableEstimate
    };
  }

  const alignedTracking = shiftSeries(trackingRemote, estimatedShiftMs * samplesPerMs);
  const alignedProtection = shiftSeries(remoteReceived, estimatedShiftMs * samplesPerMs);
  const endStart = Math.max(0, local.length - Math.round(samplesPerCycle * 1.5));
  const trackingCorrelation = normalizedCorrelation(local, alignedTracking, endStart);
  const uncertaintyMs = estimateBlindUncertaintyMs({
    config,
    channel: receiverChannel,
    tracker,
    trackingCorrelation
  });

  return {
    aligned: alignedProtection,
    alignedProtection,
    alignedTracking,
    estimatedShiftMs,
    pingPongEstimateMs,
    trackingCorrectionMs,
    uncertaintyMs,
    trackingCorrelation,
    tracker,
    trackerState: nextTrackerState
  };
}
