import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, PROTECTION_STATES, createDefaultConfig } from './constants.js';
import { createChannelSnapshot, sampleTimingJitterMs, shouldDropSample } from './channel-model.js';
import { alignRemote } from './algorithms.js';
import { calculateConfidence } from './confidence.js';
import { clamp, normalizedCorrelation, rms, round } from './math.js';
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

function arraysToPlain(frame) {
  return {
    ...frame,
    waveforms: Object.fromEntries(
      Object.entries(frame.waveforms).map(([key, value]) => [key, Array.from(value, (sample) => Number.isFinite(sample) ? sample : null)])
    )
  };
}

export class Simulator {
  constructor(initialConfig = createDefaultConfig()) {
    this.config = sanitizeConfig(initialConfig);
    this.timeSeconds = 0;
    this.frameIndex = 0;
    this.previousTrackingMs = 0;
    this.tripPersistenceMs = 0;
    this.stateMachine = new ProtectionStateMachine(this.config);
    this.events = [];
    this.lastProtectionState = this.stateMachine.state;
  }

  setConfig(patch) {
    const previousAlgorithm = this.config.algorithm;
    this.config = sanitizeConfig({ ...this.config, ...patch });
    if (previousAlgorithm !== this.config.algorithm) {
      this.previousTrackingMs = 0;
      this.stateMachine.reset(this.config);
      this.tripPersistenceMs = 0;
      this.pushEvent('ALGORITHM_CHANGED', modeLabel(this.config.algorithm));
    }
  }

  reset(config = this.config) {
    this.config = sanitizeConfig(config);
    this.timeSeconds = 0;
    this.frameIndex = 0;
    this.previousTrackingMs = 0;
    this.tripPersistenceMs = 0;
    this.events = [];
    this.stateMachine.reset(this.config);
    this.lastProtectionState = this.stateMachine.state;
    this.pushEvent('RESET', 'Experiment reset');
  }

  pushEvent(code, message) {
    this.events.unshift({
      timeSeconds: round(this.timeSeconds, 3),
      code,
      message
    });
    this.events = this.events.slice(0, 10);
  }

  step(deltaMs = 20) {
    const scaledDeltaMs = deltaMs * this.config.simulationSpeed;
    this.timeSeconds += scaledDeltaMs / 1000;
    this.frameIndex += 1;

    const samplesPerCycle = Math.round(this.config.sampleRateHz / this.config.frequencyHz);
    const sampleCount = Math.max(160, Math.round(samplesPerCycle * this.config.windowCycles));
    const windowSeconds = sampleCount / this.config.sampleRateHz;
    const windowStart = this.timeSeconds - windowSeconds;
    const channel = createChannelSnapshot(this.config, this.timeSeconds, this.frameIndex);

    const local = new Float64Array(sampleCount);
    const remoteReceived = new Float64Array(sampleCount);
    remoteReceived.fill(Number.NaN);

    for (let index = 0; index < sampleCount; index += 1) {
      const displayTime = windowStart + index / this.config.sampleRateHz;
      local[index] = terminalCurrentAt(displayTime, 'local', this.config);
      const globalSampleIndex = Math.round(displayTime * this.config.sampleRateHz);
      if (shouldDropSample(this.config, channel, globalSampleIndex)) continue;
      const jitterMs = sampleTimingJitterMs(this.config, globalSampleIndex);
      const sourceTime = displayTime - (channel.forwardMs + channel.clockErrorMs + jitterMs) / 1000;
      remoteReceived[index] = terminalCurrentAt(sourceTime, 'remote', this.config);
    }

    const validFraction = countFinite(remoteReceived) / remoteReceived.length;
    const alignment = alignRemote({
      local,
      remoteReceived,
      config: this.config,
      channel,
      previousTrackingMs: this.previousTrackingMs
    });
    if (this.config.algorithm === ALGORITHM_MODES.SMART_TRACKING) {
      this.previousTrackingMs = alignment.trackingCorrectionMs;
    } else {
      this.previousTrackingMs = 0;
    }

    const rawIdiff = combineAbsolute(local, remoteReceived);
    const validatedIdiff = combineAbsolute(local, alignment.aligned);
    const irestraint = restraintSeries(local, alignment.aligned);
    const cycleStart = Math.max(0, sampleCount - samplesPerCycle);
    const idiffRawRms = rms(rawIdiff, cycleStart);
    const idiffValidatedRms = rms(validatedIdiff, cycleStart);
    const irestraintRms = rms(irestraint, cycleStart);
    const pickupPu = this.config.minPickupPu + this.config.restraintSlope * irestraintRms;

    const directionCorrelation = normalizedCorrelation(local, alignment.aligned, cycleStart);
    const electricalChange = this.config.scenario !== ELECTRICAL_SCENARIOS.THROUGH;
    const faultEvidence = clamp(
      ((directionCorrelation + 1) / 2) * clamp(idiffValidatedRms / Math.max(pickupPu, 0.01), 0, 1.4),
      0,
      1
    );

    const confidence = calculateConfidence({
      config: this.config,
      channel,
      alignment,
      validFraction,
      electricalChange
    });

    const protection = this.stateMachine.update({
      config: this.config,
      confidence,
      deltaMs: scaledDeltaMs
    });

    const secureThreshold = pickupPu * this.config.securePickupMultiplier;
    let threshold = pickupPu;
    let tripAllowed = protection.permission !== 'BLOCKED';
    let requiredPersistenceMs = 20;

    if (protection.state === PROTECTION_STATES.WATCH) {
      threshold *= 1.15;
      requiredPersistenceMs = 35;
    } else if (protection.state === PROTECTION_STATES.SECURE) {
      threshold = secureThreshold;
      tripAllowed = faultEvidence > 0.78 && confidence.waveform.score > 55;
      requiredPersistenceMs = 45;
    } else if (protection.state === PROTECTION_STATES.RECOVERY) {
      tripAllowed = false;
    }

    if (tripAllowed && idiffValidatedRms >= threshold) {
      this.tripPersistenceMs += scaledDeltaMs;
    } else {
      this.tripPersistenceMs = 0;
    }
    const operate = this.tripPersistenceMs >= requiredPersistenceMs;

    if (this.lastProtectionState !== protection.state) {
      this.pushEvent('STATE_CHANGE', `${this.lastProtectionState} → ${protection.state}`);
      this.lastProtectionState = protection.state;
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
      channel,
      alignment,
      confidence,
      protection,
      idiffValidatedRms,
      pickupPu,
      decision
    });

    return arraysToPlain({
      schemaVersion: 1,
      timeSeconds: round(this.timeSeconds, 4),
      frameIndex: this.frameIndex,
      modeLabel: modeLabel(this.config.algorithm),
      scenarioLabel: scenarioLabel(this.config.scenario),
      waveforms: {
        local,
        remoteReceived,
        remoteAligned: alignment.aligned,
        rawIdiff,
        validatedIdiff
      },
      channel: {
        forwardMs: round(channel.forwardMs, 3),
        returnMs: round(channel.returnMs, 3),
        rttMs: round(channel.rttMs, 3),
        packetAgeMs: round(channel.packetAgeMs, 3),
        lossPct: round(channel.frameLossProbability * 100, 2),
        burstActive: channel.burstActive,
        corruption: channel.corruption
      },
      alignment: {
        estimatedShiftMs: round(alignment.estimatedShiftMs, 3),
        pingPongEstimateMs: round(alignment.pingPongEstimateMs, 3),
        trackingCorrectionMs: round(alignment.trackingCorrectionMs, 3),
        residualEstimateMs: round(alignment.residualEstimateMs, 3),
        correlation: round(alignment.alignedCorrelation, 4),
        trackerPeak: round(alignment.tracker.peakScore, 4),
        trackerAmbiguity: round(alignment.tracker.ambiguity, 4),
        predictedFraction: round(alignment.tracker.predictedFraction, 4)
      },
      differential: {
        rawRmsPu: round(idiffRawRms, 4),
        validatedRmsPu: round(idiffValidatedRms, 4),
        restraintRmsPu: round(irestraintRms, 4),
        pickupPu: round(pickupPu, 4),
        activeThresholdPu: round(threshold, 4),
        marginPu: round(threshold - idiffValidatedRms, 4),
        faultEvidence: round(faultEvidence, 4)
      },
      confidence,
      protection: {
        ...protection,
        secureRemainingMs: round(protection.secureRemainingMs, 1),
        decision,
        operate,
        tripAllowed
      },
      explanation,
      events: [...this.events]
    });
  }
}

function explainFrame({ config, channel, alignment, confidence, protection, idiffValidatedRms, pickupPu, decision }) {
  const cause = confidence.reasons[0] ?? 'QUALITY_NOMINAL';
  let changed = 'Communication and alignment remain inside the educational quality limits.';
  if (cause === 'PATH_ASYMMETRY') changed = 'Forward and return communication paths no longer have equal delay.';
  if (cause === 'JITTER_HIGH') changed = 'Remote sample arrival time is varying rapidly.';
  if (cause === 'PACKET_LOSS_BURST') changed = 'A burst of remote samples is missing or late.';
  if (cause === 'TIME_SYNC_INVALID') changed = 'The remote absolute time source is not valid.';
  if (cause === 'ALIGNMENT_UNCERTAIN') changed = 'The estimated remote waveform position has excessive residual uncertainty.';
  if (cause === 'TRACKING_AMBIGUOUS') changed = 'The waveform tracker found more than one plausible alignment position.';
  if (cause === 'PACKET_INTEGRITY_FAIL') changed = 'Remote packet integrity failed the hard validity gate.';

  const why = config.algorithm === ALGORITHM_MODES.SMART_TRACKING
    ? `The tracker applied ${alignment.trackingCorrectionMs.toFixed(2)} ms inside a bounded search window; confidence is ${confidence.waveform.score.toFixed(0)}%.`
    : config.algorithm === ALGORITHM_MODES.GPS
      ? `Timestamp alignment leaves approximately ${Math.abs(alignment.residualEstimateMs).toFixed(2)} ms residual uncertainty.`
      : `RTT/2 estimates ${alignment.pingPongEstimateMs.toFixed(2)} ms while the actual forward path is ${channel.forwardMs.toFixed(2)} ms.`;

  const action = protection.permission === 'BLOCKED'
    ? 'Remote data is not permitted to initiate 87L tripping.'
    : protection.state === PROTECTION_STATES.SECURE
      ? `87L uses raised security for ${protection.secureRemainingMs.toFixed(0)} ms while evidence is revalidated.`
      : decision === 'OPERATE'
        ? `Validated Idiff ${idiffValidatedRms.toFixed(2)} pu exceeds the active ${pickupPu.toFixed(2)} pu characteristic with sufficient persistence.`
        : '87L remains available under the current protection permission.';

  return { changed, why, action };
}
