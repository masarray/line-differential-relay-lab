import { ALGORITHM_MODES } from './constants.js';
import { clamp, estimateLag, fillSmallGaps, normalizedCorrelation, shiftSeries } from './math.js';

export function alignRemote({ local, remoteReceived, config, channel, previousTrackingMs = 0 }) {
  const samplesPerMs = config.sampleRateHz / 1000;
  const pingPongEstimateMs = channel.rttMs / 2;
  let estimatedShiftMs = pingPongEstimateMs;
  let trackingCorrectionMs = 0;
  let tracker = {
    peakScore: 0,
    ambiguity: 1,
    correlation: 0,
    predictedFraction: 0
  };

  const maxGapSamples = Math.max(1, Math.round(config.sampleRateHz / config.frequencyHz / 10));
  const gapFilled = fillSmallGaps(remoteReceived, maxGapSamples);
  const usableRemote = gapFilled.values;
  tracker.predictedFraction = gapFilled.predictedCount / Math.max(1, remoteReceived.length);

  if (config.algorithm === ALGORITHM_MODES.GPS) {
    estimatedShiftMs = channel.forwardMs;
  }

  if (config.algorithm === ALGORITHM_MODES.SMART_TRACKING) {
    const coarseAligned = shiftSeries(usableRemote, pingPongEstimateMs * samplesPerMs);
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
      correlation: lag.correlation
    };
  }

  const aligned = shiftSeries(usableRemote, estimatedShiftMs * samplesPerMs);
  const residualEstimateMs = channel.forwardMs + channel.clockErrorMs - estimatedShiftMs;
  const endStart = Math.max(0, local.length - Math.round((config.sampleRateHz / config.frequencyHz) * 1.5));
  const alignedCorrelation = normalizedCorrelation(local, aligned, endStart);

  return {
    aligned,
    estimatedShiftMs,
    pingPongEstimateMs,
    trackingCorrectionMs,
    residualEstimateMs,
    alignedCorrelation,
    tracker
  };
}
