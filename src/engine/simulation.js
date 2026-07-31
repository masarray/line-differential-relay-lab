import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, PROTECTION_STATES, createDefaultConfig } from './constants.js';
import { createPacketChannelWindow } from './channel-model.js';
import { alignRemote } from './algorithms.js';
import { calculateConfidence } from './confidence.js';
import { clamp, finitePairFraction, normalizedCorrelation, rms, round } from './math.js';
import { sanitizeConfig } from './schema.js';
import { terminalCurrentAt } from './signal-model.js';
import { ProtectionStateMachine } from './state-machine.js';

function modeLabel(mode) {
  return {
    [ALGORITHM_MODES.PING_PONG]: 'Conventional ping-pong',
    [ALGORITHM_MODES.SECURE_WINDOW]: 'Ping-pong + secure window',
    [ALGORITHM_MODES.GPS]: 'GPS time synchronization',
    [ALGORITHM_MODES.SMART_TRACKING]: 'Smart waveform tracking'
  }[mode] ?? mode;
}

function scenarioLabel(scenario) {
  return {
    [ELECTRICAL_SCENARIOS.THROUGH]: 'Healthy through current',
    [ELECTRICAL_SCENARIOS.LOAD_STEP]: 'Dynamic load step',
    [ELECTRICAL_SCENARIOS.EXTERNAL_FAULT]: 'External through fault',
    [ELECTRICAL_SCENARIOS.INTERNAL_FAULT]: 'Internal fault',
    [ELECTRICAL_SCENARIOS.CT_ERROR]: 'CT / waveform error'
  }[scenario] ?? scenario;
}

function numericArray(length, callback) {
  const output = new Float64Array(length);
  for (let index = 0; index < length; index += 1) output[index] = callback(index);
  return output;
}

function combineAbsolute(a, b) {
  return numericArray(Math.min(a.length, b.length), (index) => {
    if (!Number.isFinite(a[index]) || !Number.isFinite(b[index])) return Number.NaN;
    return Math.abs(a[index] + b[index]);
  });
}

function restraintSeries(local, remote) {
  return numericArray(Math.min(local.length, remote.length), (index) => {
    if (!Number.isFinite(local[index]) || !Number.isFinite(remote[index])) return Number.NaN;
    return (Math.abs(local[index]) + Math.abs(remote[index])) / 2;
  });
}

function countFinite(values) {
  let count = 0;
  for (const value of values) if (Number.isFinite(value)) count += 1;
  return count;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function arraysToPlain(frame) {
  return {
    ...frame,
    waveforms: Object.fromEntries(
      Object.entries(frame.waveforms).map(([key, value]) => [
        key,
        Array.from(value, (sample) => Number.isFinite(sample) ? sample : null)
      ])
    )
  };
}

function emptyTrackerState() {
  return {
    initialized: false,
    correctionMs: 0,
    velocityMs: 0,
    heldFrames: 0,
    electricalHoldFrames: 0
  };
}

function packetSignature(receiver) {
  return [
    receiver.sequenceGapCount,
    receiver.duplicateFrames,
    receiver.reorderedFrames,
    receiver.lateFrames,
    receiver.queueOverflowFrames,
    receiver.routeTransitionActive ? 1 : 0
  ].join(':');
}

export class Simulator {
  constructor(initialConfig = createDefaultConfig()) {
    this.config = sanitizeConfig(initialConfig);
    this.timeSeconds = 0;
    this.frameIndex = 0;
    this.trackerState = emptyTrackerState();
    this.previousRttMs = null;
    this.rttHistory = [];
    this.tripPersistenceMs = 0;
    this.stateMachine = new ProtectionStateMachine(this.config);
    this.events = [];
    this.lastProtectionState = this.stateMachine.state;
    this.lastPacketSignature = '';
  }

  setConfig(patch) {
    const previousAlgorithm = this.config.algorithm;
    this.config = sanitizeConfig({ ...this.config, ...patch });
    if (previousAlgorithm !== this.config.algorithm) {
      this.trackerState = emptyTrackerState();
      this.previousRttMs = null;
      this.rttHistory = [];
      this.stateMachine.reset(this.config);
      this.tripPersistenceMs = 0;
      this.pushEvent('ALGORITHM_CHANGED', modeLabel(this.config.algorithm));
    }
  }

  reset(config = this.config) {
    this.config = sanitizeConfig(config);
    this.timeSeconds = 0;
    this.frameIndex = 0;
    this.trackerState = emptyTrackerState();
    this.previousRttMs = null;
    this.rttHistory = [];
    this.tripPersistenceMs = 0;
    this.events = [];
    this.stateMachine.reset(this.config);
    this.lastProtectionState = this.stateMachine.state;
    this.lastPacketSignature = '';
    this.pushEvent('RESET', 'Experiment reset');
  }

  pushEvent(code, message) {
    this.events.unshift({ timeSeconds: round(this.timeSeconds, 3), code, message });
    this.events = this.events.slice(0, 10);
  }

  step(deltaMs = 20) {
    const scaledDeltaMs = deltaMs * this.config.simulationSpeed;
    this.timeSeconds += scaledDeltaMs / 1000;
    this.frameIndex += 1;

    const samplesPerCycle = Math.round(this.config.sampleRateHz / this.config.frequencyHz);
    const samplesPerMs = this.config.sampleRateHz / 1000;
    const sampleCount = Math.max(160, Math.round(samplesPerCycle * this.config.windowCycles));
    const windowSeconds = sampleCount / this.config.sampleRateHz;
    const windowStart = this.timeSeconds - windowSeconds;

    const local = new Float64Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      const displayTime = windowStart + index / this.config.sampleRateHz;
      local[index] = terminalCurrentAt(displayTime, 'local', this.config);
    }

    const transport = createPacketChannelWindow({
      config: this.config,
      simulationTimeSeconds: this.timeSeconds,
      frameIndex: this.frameIndex,
      windowStartSeconds: windowStart,
      sampleCount,
      sampleValueAt: (sourceTimeSeconds) => terminalCurrentAt(sourceTimeSeconds, 'remote', this.config)
    });
    const plantChannel = transport.snapshot;
    const receiver = plantChannel.receiver;
    const remoteReceived = transport.remoteReceived;
    const validFraction = countFinite(remoteReceived) / remoteReceived.length;

    const rttStepMs = this.previousRttMs === null ? 0 : Math.abs(plantChannel.rttMs - this.previousRttMs);
    this.previousRttMs = plantChannel.rttMs;
    this.rttHistory.push(plantChannel.rttMs);
    this.rttHistory = this.rttHistory.slice(-12);

    const algorithmChannel = {
      rttMs: plantChannel.rttMs,
      rttStepMs,
      rttJitterMs: standardDeviation(this.rttHistory),
      packetAgeMs: plantChannel.packetAgeMs,
      observedLossFraction: receiver.observedFrameLossFraction,
      corruption: plantChannel.corruption,
      hardInvalid: plantChannel.hardInvalid || validFraction < 0.25,
      sequenceGapCount: receiver.sequenceGapCount,
      maxConsecutiveLossFrames: receiver.maxConsecutiveLossFrames,
      duplicateFrames: receiver.duplicateFrames,
      reorderedFrames: receiver.reorderedFrames,
      lateFrames: receiver.lateFrames,
      queueDepthFrames: receiver.queueDepthFrames,
      queueOverflowFrames: receiver.queueOverflowFrames,
      routeTransitionActive: receiver.routeTransitionActive,
      knownTransportLatencyMs: this.config.packetSerializationMs,
      timeSyncValid: this.config.gpsSyncValid,
      absoluteTimeShiftMs: this.config.gpsSyncValid
        ? plantChannel.forwardMs + this.config.packetSerializationMs + plantChannel.clockErrorMs
        : Number.NaN,
      timeReferenceUncertaintyMs: this.config.gpsHoldover
        ? 0.05 + Math.abs(this.config.clockDriftPpm) * this.timeSeconds / 1000
        : 0.05
    };

    const alignment = alignRemote({
      local,
      remoteReceived,
      config: this.config,
      channel: algorithmChannel,
      trackerState: this.trackerState
    });
    this.trackerState = this.config.algorithm === ALGORITHM_MODES.SMART_TRACKING
      ? alignment.trackerState
      : emptyTrackerState();

    const rawIdiff = combineAbsolute(local, remoteReceived);
    const validatedIdiff = combineAbsolute(local, alignment.alignedProtection);
    const irestraint = restraintSeries(local, alignment.alignedProtection);

    const estimatedShiftSamples = alignment.estimatedShiftMs * samplesPerMs;
    const rightGuardSamples = Math.max(2, Math.ceil(Math.max(0, estimatedShiftSamples)) + 2);
    const cycleEnd = Math.max(samplesPerCycle, sampleCount - rightGuardSamples);
    const cycleStart = Math.max(0, cycleEnd - samplesPerCycle);

    const idiffRawRms = rms(rawIdiff, cycleStart, cycleEnd);
    const idiffValidatedRms = rms(validatedIdiff, cycleStart, cycleEnd);
    const irestraintRms = rms(irestraint, cycleStart, cycleEnd);
    const protectionValidFraction = finitePairFraction(local, alignment.alignedProtection, cycleStart, cycleEnd);
    const pickupPu = this.config.minPickupPu + this.config.restraintSlope * irestraintRms;
    const directionCorrelation = normalizedCorrelation(local, alignment.alignedProtection, cycleStart, cycleEnd);
    const operateRatio = idiffValidatedRms / Math.max(pickupPu, 0.01);
    const faultEvidence = clamp(
      ((directionCorrelation + 1) / 2) * clamp(operateRatio, 0, 1.4),
      0,
      1
    );

    const alignmentEvidence = { ...alignment, protectionCorrelation: directionCorrelation };
    const confidence = calculateConfidence({
      config: this.config,
      channel: algorithmChannel,
      alignment: alignmentEvidence,
      validFraction,
      protectionValidFraction
    });
    const protection = this.stateMachine.update({ config: this.config, confidence, deltaMs: scaledDeltaMs });

    const measuredEvidenceValid = protectionValidFraction >= this.config.minProtectionValidFraction;
    const electricalHold = this.config.algorithm === ALGORITHM_MODES.SMART_TRACKING && alignment.tracker.electricalHold;
    const directionalEvidenceValid = directionCorrelation > 0.08 && faultEvidence > 0.56;
    const strongInternalEvidence =
      electricalHold &&
      directionCorrelation > 0.34 &&
      operateRatio > 1.35 &&
      protectionValidFraction >= Math.max(this.config.minProtectionValidFraction, 0.9) &&
      confidence.waveform.score > 58 &&
      !confidence.hardInvalid;

    const secureThreshold = pickupPu * this.config.securePickupMultiplier;
    let threshold = pickupPu;
    let tripAllowed = protection.permission !== 'BLOCKED' && measuredEvidenceValid && !confidence.hardInvalid;
    let requiredPersistenceMs = 20;

    if (this.config.algorithm === ALGORITHM_MODES.SMART_TRACKING && !strongInternalEvidence) {
      tripAllowed = tripAllowed && directionalEvidenceValid;
      threshold *= 1.06;
      requiredPersistenceMs = 30;
    }

    if (protection.state === PROTECTION_STATES.WATCH) {
      if (strongInternalEvidence) {
        threshold = pickupPu * 1.08;
        requiredPersistenceMs = 30;
      } else {
        threshold *= 1.15;
        requiredPersistenceMs = Math.max(requiredPersistenceMs, 35);
      }
    } else if (protection.state === PROTECTION_STATES.SECURE) {
      if (strongInternalEvidence) {
        threshold = pickupPu * 1.12;
        tripAllowed = protection.permission !== 'BLOCKED' && measuredEvidenceValid && !confidence.hardInvalid;
        requiredPersistenceMs = 30;
      } else {
        threshold = secureThreshold;
        tripAllowed = tripAllowed && faultEvidence > 0.78 && confidence.waveform.score > 55;
        requiredPersistenceMs = 45;
      }
    } else if (protection.state === PROTECTION_STATES.RECOVERY) {
      tripAllowed = false;
    }

    if (tripAllowed && idiffValidatedRms >= threshold) this.tripPersistenceMs += scaledDeltaMs;
    else this.tripPersistenceMs = 0;
    const operate = this.tripPersistenceMs >= requiredPersistenceMs;

    if (this.lastProtectionState !== protection.state) {
      this.pushEvent('STATE_CHANGE', `${this.lastProtectionState} → ${protection.state}`);
      this.lastProtectionState = protection.state;
    }

    const signature = packetSignature(receiver);
    if (signature !== this.lastPacketSignature) {
      if (receiver.routeTransitionActive) this.pushEvent('ROUTE_TRANSITION', `One-way route changed by ${plantChannel.routeOffsetMs.toFixed(2)} ms`);
      if (receiver.sequenceGapCount > 0) this.pushEvent('SEQUENCE_GAP', `${receiver.sequenceGapCount} packet sequence gap(s)`);
      if (receiver.reorderedFrames > 0) this.pushEvent('PACKET_REORDER', `${receiver.reorderedFrames} reordered frame(s)`);
      if (receiver.duplicateFrames > 0) this.pushEvent('PACKET_DUPLICATE', `${receiver.duplicateFrames} duplicate frame(s) discarded`);
      this.lastPacketSignature = signature;
    }

    if (operate && !this.events.some((event) => event.code === 'OPERATE' && this.timeSeconds - event.timeSeconds < 0.2)) {
      this.pushEvent('OPERATE', '87L operating criterion satisfied');
    }

    const decision = operate
      ? 'OPERATE'
      : protection.permission === 'BLOCKED'
        ? '87L BLOCKED'
        : protection.state === PROTECTION_STATES.SECURE
          ? 'SECURE / SUPERVISED'
          : 'STABLE';

    const explanation = explainFrame({
      config: this.config,
      alignment: alignmentEvidence,
      confidence,
      protection,
      protectionValidFraction,
      idiffValidatedRms,
      pickupPu,
      decision,
      receiver,
      strongInternalEvidence
    });
    const groundTruthResidualMs =
      plantChannel.forwardMs + this.config.packetSerializationMs + plantChannel.clockErrorMs - alignment.estimatedShiftMs;

    return arraysToPlain({
      schemaVersion: 1,
      timeSeconds: round(this.timeSeconds, 4),
      frameIndex: this.frameIndex,
      modeLabel: modeLabel(this.config.algorithm),
      scenarioLabel: scenarioLabel(this.config.scenario),
      waveforms: { local, remoteReceived, remoteAligned: alignment.alignedProtection, rawIdiff, validatedIdiff },
      channel: {
        forwardMs: round(plantChannel.forwardMs, 3),
        returnMs: round(plantChannel.returnMs, 3),
        rttMs: round(plantChannel.rttMs, 3),
        rttStepMs: round(algorithmChannel.rttStepMs, 3),
        rttJitterMs: round(algorithmChannel.rttJitterMs, 3),
        packetAgeMs: round(plantChannel.packetAgeMs, 3),
        lossPct: round(receiver.observedFrameLossFraction * 100, 2),
        burstActive: plantChannel.burstActive,
        corruption: plantChannel.corruption,
        packetIntervalMs: round(receiver.packetIntervalMs, 3),
        expectedFrames: receiver.expectedFrames,
        receivedFrames: receiver.receivedFrames,
        sequenceGapCount: receiver.sequenceGapCount,
        maxConsecutiveLossFrames: receiver.maxConsecutiveLossFrames,
        duplicateFrames: receiver.duplicateFrames,
        reorderedFrames: receiver.reorderedFrames,
        lateFrames: receiver.lateFrames,
        queueDepthFrames: receiver.queueDepthFrames,
        queueOverflowFrames: receiver.queueOverflowFrames,
        routeTransitionActive: receiver.routeTransitionActive,
        routeOffsetMs: round(plantChannel.routeOffsetMs, 3),
        firstSequence: receiver.firstSequence,
        lastSequence: receiver.lastSequence
      },
      alignment: {
        estimatedShiftMs: round(alignment.estimatedShiftMs, 3),
        pingPongEstimateMs: round(alignment.pingPongEstimateMs, 3),
        trackingCorrectionMs: round(alignment.trackingCorrectionMs, 3),
        uncertaintyMs: round(alignment.uncertaintyMs, 3),
        residualEstimateMs: round(alignment.uncertaintyMs, 3),
        correlation: round(directionCorrelation, 4),
        trackingCorrelation: round(alignment.trackingCorrelation, 4),
        trackerPeak: round(alignment.tracker.peakScore, 4),
        trackerAmbiguity: round(alignment.tracker.ambiguity, 4),
        predictedFraction: round(alignment.tracker.predictedFraction, 4),
        atSearchBoundary: alignment.tracker.atSearchBoundary,
        estimatorAgreementMs: round(alignment.tracker.estimatorAgreementMs, 4),
        trajectoryInnovationMs: round(alignment.tracker.trajectoryInnovationMs, 4),
        measurementAccepted: alignment.tracker.measurementAccepted,
        electricalHold: alignment.tracker.electricalHold,
        trackerSource: alignment.tracker.source,
        shortCorrectionMs: round((alignment.tracker.short.refinedLagSamples ?? alignment.tracker.short.lagSamples) / samplesPerMs, 4),
        stabilityCorrectionMs: round((alignment.tracker.stable.refinedLagSamples ?? alignment.tracker.stable.lagSamples) / samplesPerMs, 4),
        shortPeak: round(alignment.tracker.short.peakScore, 4),
        stabilityPeak: round(alignment.tracker.stable.peakScore, 4),
        subSampleOffset: round(alignment.tracker.stable.subSampleOffset ?? 0, 4)
      },
      differential: {
        rawRmsPu: round(idiffRawRms, 4),
        validatedRmsPu: round(idiffValidatedRms, 4),
        restraintRmsPu: round(irestraintRms, 4),
        pickupPu: round(pickupPu, 4),
        activeThresholdPu: round(threshold, 4),
        marginPu: round(threshold - idiffValidatedRms, 4),
        faultEvidence: round(faultEvidence, 4),
        directionCorrelation: round(directionCorrelation, 4),
        operateRatio: round(operateRatio, 4),
        directionalEvidenceValid,
        strongInternalEvidence,
        protectionValidFraction: round(protectionValidFraction, 4),
        measuredEvidenceValid
      },
      confidence,
      protection: { ...protection, secureRemainingMs: round(protection.secureRemainingMs, 1), decision, operate, tripAllowed },
      diagnostics: {
        groundTruthResidualMs: round(groundTruthResidualMs, 4),
        trueForwardMs: round(plantChannel.forwardMs, 4),
        trueReturnMs: round(plantChannel.returnMs, 4)
      },
      explanation,
      events: [...this.events]
    });
  }
}

function explainFrame({ config, alignment, confidence, protection, protectionValidFraction, idiffValidatedRms, pickupPu, decision, receiver, strongInternalEvidence }) {
  const cause = confidence.reasons[0] ?? 'QUALITY_NOMINAL';
  let changed = 'Packet sequence, communication timing, and alignment remain inside the educational quality limits.';
  if (cause === 'PACKET_INTEGRITY_FAIL') changed = 'A received packet failed the integrity gate.';
  if (cause === 'RECEIVER_QUEUE_OVERFLOW') changed = 'The receiver reorder queue exceeded its bounded capacity.';
  if (cause === 'REORDER_BUFFER_EXCEEDED') changed = 'An out-of-order packet arrived beyond the permitted reorder depth.';
  if (cause === 'CONSECUTIVE_FRAME_LOSS') changed = 'Consecutive missing packet frames exceeded the configured safety limit.';
  if (cause === 'PACKET_SEQUENCE_GAP') changed = 'The receiver detected a discontinuity in packet sequence numbers.';
  if (cause === 'PACKET_REORDERED') changed = 'Packets arrived out of sequence and required bounded receiver reordering.';
  if (cause === 'DUPLICATE_FRAME_DISCARDED') changed = 'A duplicate packet was detected and discarded.';
  if (cause === 'ROUTE_TRANSITION') changed = 'The one-way communication route is changing.';
  if (cause === 'RTT_UNSTABLE') changed = 'Measured round-trip delay is changing faster than the trusted timing trajectory.';
  if (cause === 'PACKET_LOSS_BURST') changed = 'A burst of measured remote packets is missing or late.';
  if (cause === 'TIME_SYNC_INVALID') changed = 'The remote absolute time source is not valid.';
  if (cause === 'ELECTRICAL_TRANSIENT_HOLD') changed = 'A coherent electrical polarity transition froze timing adaptation at the last trusted correction.';
  if (cause === 'RTT_ALIGNMENT_DISAGREEMENT') changed = 'Waveform evidence disagrees with the RTT/2 alignment estimate.';
  if (cause === 'ESTIMATOR_DISAGREEMENT') changed = 'Short-horizon and stability waveform estimators do not agree.';
  if (cause === 'TRACKING_MEASUREMENT_HELD') changed = 'The tracker rejected the new lag measurement and held its bounded trajectory.';
  if (cause === 'TRAJECTORY_INNOVATION_HIGH') changed = 'The requested timing correction exceeds the trusted delay trajectory.';
  if (cause === 'ALIGNMENT_UNCERTAIN') changed = 'The remote waveform position has excessive estimator uncertainty.';
  if (cause === 'TRACKING_AMBIGUOUS') changed = 'The waveform tracker found more than one plausible alignment position.';
  if (cause === 'TRACKER_AT_BOUNDARY') changed = 'The best waveform match reached the bounded tracking-search limit.';
  if (cause === 'INSUFFICIENT_MEASURED_DATA') changed = 'Too few measured-valid remote samples remain for protection evidence.';

  const packetContext = `SEQ ${receiver.firstSequence}…${receiver.lastSequence}; gaps ${receiver.sequenceGapCount}, reorder ${receiver.reorderedFrames}, duplicate ${receiver.duplicateFrames}.`;
  const why = config.algorithm === ALGORITHM_MODES.SMART_TRACKING
    ? `${packetContext} Short/stability agreement is ${alignment.tracker.estimatorAgreementMs.toFixed(2)} ms; the ${alignment.tracker.source.toLowerCase()} trajectory applied ${alignment.trackingCorrectionMs.toFixed(2)} ms with estimated uncertainty ±${alignment.uncertaintyMs.toFixed(2)} ms.`
    : config.algorithm === ALGORITHM_MODES.GPS
      ? `${packetContext} Common-time alignment reports estimated uncertainty ±${alignment.uncertaintyMs.toFixed(2)} ms.`
      : `${packetContext} RTT/2 provides the coarse alignment while receiver-observable uncertainty is ±${alignment.uncertaintyMs.toFixed(2)} ms.`;

  const action = protection.permission === 'BLOCKED'
    ? 'Remote data is not permitted to initiate 87L tripping.'
    : protectionValidFraction < config.minProtectionValidFraction
      ? '87L trip evidence is inhibited until measured-valid sample coverage recovers.'
      : strongInternalEvidence
        ? 'Strong measured directional differential evidence is allowed through the supervised electrical path while timing adaptation remains frozen.'
        : protection.state === PROTECTION_STATES.SECURE
          ? `87L uses raised security for ${protection.secureRemainingMs.toFixed(0)} ms while packet and waveform evidence are revalidated.`
          : decision === 'OPERATE'
            ? `Measured-only Idiff ${idiffValidatedRms.toFixed(2)} pu exceeds the active ${pickupPu.toFixed(2)} pu characteristic with sufficient persistence.`
            : '87L remains available under the current protection permission.';

  return { changed, why, action };
}
