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

function estimateBlindUncertaintyMs({ config, channel, tracker, trackingCorrelation }) {
  const sampleResolutionMs = 500 / config.sampleRateHz;
  const rttInstabilityMs = (channel.rttStepMs ?? 0) * 0.35 + (channel.rttJitterMs ?? 0) * 0.5;

  if (config.algorithm === ALGORITHM_MODES.GPS) {
    return sampleResolutionMs + (channel.timeReferenceUncertaintyMs ?? 0.05);
  }

  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING) {
    const peakDeficitMs = (1 - tracker.peakScore) * config.trackWindowMs;
    const ambiguityMs = tracker.ambiguity * (1 - tracker.peakScore) * config.trackWindowMs * 0.75;
    const innovationMs = Math.abs(tracker.requestedCorrectionMs - tracker.acceptedCorrectionMs);
    const predictionMs = tracker.predictedFraction * config.trackWindowMs;
    return sampleResolutionMs + peakDeficitMs + ambiguityMs + innovationMs + predictionMs + rttInstabilityMs;
  }

  return sampleResolutionMs + correlationTimingUncertaintyMs(trackingCorrelation, config.frequencyHz) + rttInstabilityMs;
}

/**
 * Aligns remote current using only information available to the algorithm under
 * test. Ground-truth path delay is intentionally absent from the receiver view.
 */
export function alignRemote({ local, remoteReceived, config, channel, previousTrackingMs = 0 }) {
  const receiverChannel = receiverChannelView(channel, config.algorithm);
  const samplesPerMs = config.sampleRateHz / 1000;
  const pingPongEstimateMs = receiverChannel.rttMs / 2;
  let estimatedShiftMs = pingPongEstimateMs;
  let trackingCorrectionMs = 0;
  let tracker = {
    peakScore: 0,
    ambiguity: 1,
    correlation: 0,
    predictedFraction: 0,
    requestedCorrectionMs: 0,
    acceptedCorrectionMs: 0,
    atSearchBoundary: false
  };

  // Short interpolation is allowed only inside the tracking estimator.
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
    const maximumLagSamples = Math.round(config.trackWindowMs * samplesPerMs);
    const searchStart = Math.max(0, local.length - Math.round((config.sampleRateHz / config.frequencyHz) * 2.2));
    const lag = estimateLag(local, coarseAligned, maximumLagSamples, searchStart);
    const requestedCorrectionMs = lag.lagSamples / samplesPerMs;
    const slewMinimum = previousTrackingMs - config.trackerMaxSlewMs;
    const slewMaximum = previousTrackingMs + config.trackerMaxSlewMs;
    trackingCorrectionMs = clamp(requestedCorrectionMs, slewMinimum, slewMaximum);
    trackingCorrectionMs = clamp(trackingCorrectionMs, -config.trackWindowMs, config.trackWindowMs);
    estimatedShiftMs = pingPongEstimateMs + trackingCorrectionMs;
    tracker = {
      ...tracker,
      peakScore: lag.peakScore,
      ambiguity: lag.ambiguity,
      correlation: lag.correlation,
      requestedCorrectionMs,
      acceptedCorrectionMs: trackingCorrectionMs,
      atSearchBoundary: Math.abs(lag.lagSamples) >= Math.max(1, maximumLagSamples)
    };
  }

  const alignedTracking = shiftSeries(trackingRemote, estimatedShiftMs * samplesPerMs);
  // Protection evidence is built only from received measured samples. Missing
  // samples remain NaN and cannot contribute to Idiff, restraint, or trip.
  const alignedProtection = shiftSeries(remoteReceived, estimatedShiftMs * samplesPerMs);
  const endStart = Math.max(0, local.length - Math.round((config.sampleRateHz / config.frequencyHz) * 1.5));
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
    tracker
  };
}
