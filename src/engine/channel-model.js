import { clamp } from './math.js';
import { deterministicChance, normalNoise } from './random.js';

function routeOffsetMs(config, timeMs) {
  const delta = Number(config.routeStepDeltaMs) || 0;
  if (Math.abs(delta) < 1e-12 || timeMs < config.routeChangeAtMs) return 0;
  if (config.routeRampMs <= 0) return delta;
  const progress = clamp((timeMs - config.routeChangeAtMs) / config.routeRampMs, 0, 1);
  return delta * progress;
}

function routeTransitionActive(config, timeMs, packetIntervalMs) {
  if (Math.abs(config.routeStepDeltaMs) < 1e-12) return false;
  const start = config.routeChangeAtMs;
  const end = start + Math.max(config.routeRampMs, packetIntervalMs * 2);
  return timeMs >= start && timeMs <= end;
}

function burstLost(config, sequence) {
  const length = Math.max(1, Math.round(config.burstLengthFrames));
  for (let offset = 0; offset < length; offset += 1) {
    const startSequence = sequence - offset;
    if (deterministicChance(config.seed + startSequence * 151 + 31, config.burstLossPct / 100)) {
      return true;
    }
  }
  return false;
}

function createPacketEvent(config, sequence, samplePeriodMs, packetIntervalMs) {
  const packetStartSample = sequence * config.packetSamples;
  const packetEndSample = packetStartSample + config.packetSamples - 1;
  const packetEndTimeMs = packetEndSample * samplePeriodMs;
  const routeMs = routeOffsetMs(config, packetEndTimeMs);
  const forwardJitterMs = normalNoise(config.seed + sequence * 17 + 11) * config.jitterMs;
  const returnJitterMs = normalNoise(config.seed + sequence * 19 + 23) * config.jitterMs;
  const forwardMs = Math.max(0.05, config.baseDelayMs + config.asymmetryMs / 2 + routeMs + forwardJitterMs);
  const returnMs = Math.max(0.05, config.baseDelayMs - config.asymmetryMs / 2 + returnJitterMs);
  const randomLoss = deterministicChance(config.seed + sequence * 101 + 47, config.packetLossPct / 100);
  const inBurst = burstLost(config, sequence);
  const corrupted = deterministicChance(config.seed + sequence * 37 + 5, config.corruptionPct / 100);
  const duplicated = deterministicChance(config.seed + sequence * 211 + 13, config.duplicatePct / 100);
  const reorderTriggered = deterministicChance(config.seed + sequence * 223 + 17, config.reorderPct / 100);
  const reorderScale = 0.75 + Math.abs(normalNoise(config.seed + sequence * 227 + 29)) * 0.35;
  const reorderDelayMs = reorderTriggered ? config.reorderExtraDelayMs * reorderScale : 0;
  const rawArrivalTimeMs = packetEndTimeMs + forwardMs + config.packetSerializationMs + reorderDelayMs;

  return {
    sequence,
    packetStartSample,
    packetEndSample,
    packetEndTimeMs,
    forwardMs,
    returnMs,
    rttMs: forwardMs + returnMs,
    routeOffsetMs: routeMs,
    routeTransitionActive: routeTransitionActive(config, packetEndTimeMs, packetIntervalMs),
    randomLoss,
    burstLost: inBurst,
    lost: randomLoss || inBurst,
    corrupted,
    duplicated,
    reorderTriggered,
    reorderDelayMs,
    rawArrivalTimeMs,
    reorderDepth: 0,
    reordered: false,
    late: false,
    queueOverflow: false,
    accepted: false,
    releaseTimeMs: Number.NaN
  };
}

function analyseArrivalOrder(events, config, packetIntervalMs) {
  const viable = events.filter((event) => !event.lost && !event.corrupted);
  for (const event of viable) {
    let depth = 0;
    for (const other of viable) {
      if (other.sequence > event.sequence && other.rawArrivalTimeMs < event.rawArrivalTimeMs) depth += 1;
    }
    event.reorderDepth = depth;
    event.reordered = depth > 0 || event.reorderTriggered;
    event.late = depth > config.reorderBufferFrames;
    event.queueOverflow = depth + 1 > config.maxReceiverQueueFrames;
    event.accepted = !event.late && !event.queueOverflow;
  }

  let previousReleaseTimeMs = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    if (!event.accepted) continue;
    event.releaseTimeMs = Math.max(event.rawArrivalTimeMs, previousReleaseTimeMs + packetIntervalMs);
    previousReleaseTimeMs = event.releaseTimeMs;
  }
}

function packetMetrics(events, config, metricStartMs, metricEndMs, packetIntervalMs) {
  const relevant = events.filter((event) =>
    event.packetEndTimeMs >= metricStartMs && event.packetEndTimeMs <= metricEndMs
  );
  let receivedFrames = 0;
  let lostFrames = 0;
  let corruptedFrames = 0;
  let duplicateFrames = 0;
  let reorderedFrames = 0;
  let lateFrames = 0;
  let queueOverflowFrames = 0;
  let sequenceGapCount = 0;
  let maxConsecutiveLossFrames = 0;
  let currentConsecutiveLossFrames = 0;
  let maxReorderDepth = 0;
  let maxPacketAgeMs = 0;
  let routeTransition = false;

  for (const event of relevant) {
    if (event.duplicated) duplicateFrames += 1;
    if (event.reordered) reorderedFrames += 1;
    if (event.late) lateFrames += 1;
    if (event.queueOverflow) queueOverflowFrames += 1;
    maxReorderDepth = Math.max(maxReorderDepth, event.reorderDepth);
    routeTransition ||= event.routeTransitionActive;

    if (event.accepted) {
      receivedFrames += 1;
      currentConsecutiveLossFrames = 0;
      maxPacketAgeMs = Math.max(maxPacketAgeMs, event.releaseTimeMs - event.packetEndTimeMs);
    } else {
      if (event.lost) lostFrames += 1;
      if (event.corrupted) corruptedFrames += 1;
      if (currentConsecutiveLossFrames === 0) sequenceGapCount += 1;
      currentConsecutiveLossFrames += 1;
      maxConsecutiveLossFrames = Math.max(maxConsecutiveLossFrames, currentConsecutiveLossFrames);
    }
  }

  const expectedFrames = relevant.length;
  const rejectedFrames = Math.max(0, expectedFrames - receivedFrames);
  return {
    packetIntervalMs,
    expectedFrames,
    receivedFrames,
    rejectedFrames,
    lostFrames,
    corruptedFrames,
    duplicateFrames,
    reorderedFrames,
    lateFrames,
    queueOverflowFrames,
    sequenceGapCount,
    maxConsecutiveLossFrames,
    maxReorderDepth,
    queueDepthFrames: Math.min(config.maxReceiverQueueFrames + 1, maxReorderDepth + 1),
    maxPacketAgeMs,
    observedFrameLossFraction: expectedFrames ? rejectedFrames / expectedFrames : 0,
    routeTransitionActive: routeTransition,
    firstSequence: relevant[0]?.sequence ?? 0,
    lastSequence: relevant.at(-1)?.sequence ?? 0
  };
}

/**
 * Packet/frame-driven transport model. Each packet owns a sequence number and
 * all of its samples share loss, corruption, duplication, ordering and route
 * behaviour. The receiver reconstructs a measured-only sample stream.
 */
export function createPacketChannelWindow({
  config,
  simulationTimeSeconds,
  frameIndex,
  windowStartSeconds,
  sampleCount,
  sampleValueAt
}) {
  const samplePeriodMs = 1000 / config.sampleRateHz;
  const packetIntervalMs = config.packetSamples * samplePeriodMs;
  const windowStartMs = windowStartSeconds * 1000;
  const simulationTimeMs = simulationTimeSeconds * 1000;
  const maxTransportMs =
    config.baseDelayMs + Math.abs(config.asymmetryMs) / 2 + Math.abs(config.routeStepDeltaMs) +
    config.jitterMs * 4 + config.packetSerializationMs + config.reorderExtraDelayMs +
    packetIntervalMs * (config.reorderBufferFrames + 3);
  const sourceStartMs = windowStartMs - maxTransportMs - packetIntervalMs;
  const sourceEndMs = simulationTimeMs + packetIntervalMs;
  const sequenceStart = Math.floor((sourceStartMs / samplePeriodMs) / config.packetSamples) - 2;
  const sequenceEnd = Math.ceil((sourceEndMs / samplePeriodMs) / config.packetSamples) + 2;
  const events = [];
  for (let sequence = sequenceStart; sequence <= sequenceEnd; sequence += 1) {
    events.push(createPacketEvent(config, sequence, samplePeriodMs, packetIntervalMs));
  }
  analyseArrivalOrder(events, config, packetIntervalMs);

  const remoteReceived = new Float64Array(sampleCount);
  remoteReceived.fill(Number.NaN);
  const clockDriftMs = (config.clockDriftPpm * simulationTimeSeconds) / 1000;
  const clockErrorMs = config.clockOffsetMs + clockDriftMs;

  for (const event of events) {
    if (!event.accepted || !Number.isFinite(event.releaseTimeMs)) continue;
    const receiverEndIndex = Math.round((event.releaseTimeMs - windowStartMs) / samplePeriodMs);
    for (let offset = 0; offset < config.packetSamples; offset += 1) {
      const receiverIndex = receiverEndIndex - (config.packetSamples - 1 - offset);
      if (receiverIndex < 0 || receiverIndex >= sampleCount) continue;
      const sourceSampleIndex = event.packetStartSample + offset;
      const sourceTimeSeconds = sourceSampleIndex / config.sampleRateHz - clockErrorMs / 1000;
      remoteReceived[receiverIndex] = sampleValueAt(sourceTimeSeconds);
    }
  }

  const metrics = packetMetrics(events, config, sourceStartMs, simulationTimeMs, packetIntervalMs);
  const currentRouteOffsetMs = routeOffsetMs(config, simulationTimeMs);
  const currentForwardJitterMs = normalNoise(config.seed + frameIndex * 17 + 11) * config.jitterMs;
  const currentReturnJitterMs = normalNoise(config.seed + frameIndex * 19 + 23) * config.jitterMs;
  const forwardMs = Math.max(0.05, config.baseDelayMs + config.asymmetryMs / 2 + currentRouteOffsetMs + currentForwardJitterMs);
  const returnMs = Math.max(0.05, config.baseDelayMs - config.asymmetryMs / 2 + currentReturnJitterMs);
  const packetAgeMs = Math.max(
    metrics.maxPacketAgeMs,
    forwardMs + config.packetSerializationMs + packetIntervalMs
  );
  const corruption = metrics.corruptedFrames > 0;
  const hardInvalid =
    corruption ||
    packetAgeMs > config.packetAbsoluteAgeMs ||
    metrics.maxConsecutiveLossFrames > config.maxConsecutiveLossFrames ||
    metrics.queueOverflowFrames > 0;

  return {
    remoteReceived,
    snapshot: {
      forwardMs,
      returnMs,
      rttMs: forwardMs + returnMs,
      clockErrorMs,
      packetAgeMs,
      frameLossProbability: metrics.observedFrameLossFraction,
      burstActive: metrics.maxConsecutiveLossFrames > 1,
      corruption,
      hardInvalid,
      routeOffsetMs: currentRouteOffsetMs,
      routeTransitionActive: metrics.routeTransitionActive,
      receiver: metrics
    },
    packets: events
  };
}

/** Compatibility helpers retained for external educational experiments. */
export function createChannelSnapshot(config, simulationTimeSeconds, frameIndex) {
  const packetIntervalMs = config.packetSamples * (1000 / config.sampleRateHz);
  const routeMs = routeOffsetMs(config, simulationTimeSeconds * 1000);
  const jitterForward = normalNoise(config.seed + frameIndex * 17 + 11) * config.jitterMs;
  const jitterReturn = normalNoise(config.seed + frameIndex * 19 + 23) * config.jitterMs;
  const forwardMs = Math.max(0.05, config.baseDelayMs + config.asymmetryMs / 2 + routeMs + jitterForward);
  const returnMs = Math.max(0.05, config.baseDelayMs - config.asymmetryMs / 2 + jitterReturn);
  const clockDriftMs = (config.clockDriftPpm * simulationTimeSeconds) / 1000;
  const clockErrorMs = config.clockOffsetMs + clockDriftMs;
  return {
    forwardMs,
    returnMs,
    rttMs: forwardMs + returnMs,
    clockErrorMs,
    packetAgeMs: forwardMs + config.packetSerializationMs + packetIntervalMs,
    frameLossProbability: config.packetLossPct / 100,
    burstActive: false,
    corruption: false,
    hardInvalid: false,
    routeOffsetMs: routeMs,
    routeTransitionActive: routeTransitionActive(config, simulationTimeSeconds * 1000, packetIntervalMs)
  };
}

export function shouldDropSample(config, channel, globalSampleIndex) {
  return deterministicChance(config.seed + globalSampleIndex * 101 + 47, channel.frameLossProbability ?? 0);
}

export function sampleTimingJitterMs(config, globalSampleIndex) {
  return normalNoise(config.seed + globalSampleIndex * 73 + 97) * config.jitterMs * 0.28;
}
