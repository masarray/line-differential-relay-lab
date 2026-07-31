import {
  ALGORITHM_MODES,
  ELECTRICAL_SCENARIOS,
  PROTECTION_STATES,
  SECURITY_POLICIES,
  createDefaultConfig
} from '../engine/constants.js';
import { hash32, mulberry32 } from '../engine/random.js';
import { Simulator } from '../engine/simulation.js';

export const STRESS_PROFILE_IDS = Object.freeze({
  CONVENTIONAL: 'conventional-rtt2',
  COMMUNICATION_SUPERVISED: 'communication-supervised-rtt2',
  FIXED_OBSERVATION_WINDOW: 'fixed-observation-window',
  SMART_WAVEFORM: 'smart-waveform-assisted'
});

export const DEFAULT_STRESS_PROFILES = Object.freeze([
  {
    id: STRESS_PROFILE_IDS.CONVENTIONAL,
    label: 'Conventional RTT/2',
    algorithm: ALGORITHM_MODES.PING_PONG,
    securityPolicy: SECURITY_POLICIES.COMMUNICATION_SUPERVISED,
    settings: {}
  },
  {
    id: STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED,
    label: 'Communication-supervised RTT/2',
    algorithm: ALGORITHM_MODES.SECURE_WINDOW,
    securityPolicy: SECURITY_POLICIES.COMMUNICATION_SUPERVISED,
    settings: {
      secureWindowMs: 120,
      recoveryValidationMs: 180,
      securePickupMultiplier: 1.55
    }
  },
  {
    id: STRESS_PROFILE_IDS.FIXED_OBSERVATION_WINDOW,
    label: 'Fixed observation window',
    algorithm: ALGORITHM_MODES.SECURE_WINDOW,
    securityPolicy: SECURITY_POLICIES.FIXED_OBSERVATION_WINDOW,
    settings: {
      secureWindowMs: 80,
      recoveryValidationMs: 120,
      securePickupMultiplier: 1.55
    }
  },
  {
    id: STRESS_PROFILE_IDS.SMART_WAVEFORM,
    label: 'Waveform-assisted security',
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    securityPolicy: SECURITY_POLICIES.COMMUNICATION_SUPERVISED,
    settings: {}
  }
]);

export const DEFAULT_STRESS_OPTIONS = Object.freeze({
  seed: 87161850,
  seeds: 12,
  episodes: 180,
  stepMs: 20,
  warmupMs: 420,
  profiles: DEFAULT_STRESS_PROFILES.map((profile) => profile.id),
  includeReplayDetails: true,
  stopAfterFirstTrip: false
});

const PROFILE_MAP = new Map(DEFAULT_STRESS_PROFILES.map((profile) => [profile.id, profile]));

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function range(random, minimum, maximum) {
  return minimum + (maximum - minimum) * random();
}

function integer(random, minimum, maximum) {
  return Math.floor(range(random, minimum, maximum + 1));
}

function pick(random, values) {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function runSeed(masterSeed, index) {
  return (hash32(masterSeed + Math.imul(index + 1, 0x5bd1e995)) % 2_147_483_646) + 1;
}

function cleanPatch() {
  return {
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    baseDelayMs: 3,
    asymmetryMs: 0,
    jitterMs: 0.04,
    packetLossPct: 0,
    burstLossPct: 0,
    burstLengthFrames: 3,
    corruptionPct: 0,
    duplicatePct: 0,
    reorderPct: 0,
    reorderExtraDelayMs: 3,
    reorderBufferFrames: 3,
    packetSamples: 8,
    packetSerializationMs: 0.12,
    routeStepDeltaMs: 0,
    routeRampMs: 0,
    maxConsecutiveLossFrames: 8,
    maxReceiverQueueFrames: 12,
    packetAbsoluteAgeMs: 80,
    remoteMagnitudePct: 100,
    remotePhaseDeg: 0,
    halfWaveAsymmetryPct: 0,
    harmonic3Pct: 0,
    dcOffsetPct: 0,
    ctSaturationPct: 0,
    clockOffsetMs: 0,
    clockDriftPpm: 3
  };
}

function phase(name, durationMs, patch, metadata = {}) {
  return { name, durationMs, patch, ...metadata };
}

export function generateStressSchedule(seed, options = {}) {
  const episodes = Math.max(1, Math.floor(Number(options.episodes ?? DEFAULT_STRESS_OPTIONS.episodes)));
  const random = mulberry32(hash32(seed));
  const schedule = [];
  let equivalentExposureMs = 0;

  for (let index = 0; index < episodes; index += 1) {
    const forcedOpportunity = index >= 6 && (index + 1) % 11 === 0;
    const criticalOpportunity = forcedOpportunity || (index >= 4 && random() < 0.12);
    const sign = random() < 0.5 ? -1 : 1;
    const moderateAsymmetryMs = sign * range(random, 1.1, 3.1);
    const criticalAsymmetryMs = sign * range(random, 7.4, 10.8);
    const stressAsymmetryMs = criticalOpportunity ? criticalAsymmetryMs : moderateAsymmetryMs;
    const equivalentIdleMs = range(random, 2.5, 18) * 60_000;
    equivalentExposureMs += equivalentIdleMs;

    const flapMs = integer(random, 80, 180);
    const partialRecoveryMs = integer(random, 100, 220);
    const deceptiveRecoveryMs = integer(random, 220, 360);
    const routeFlipMs = integer(random, 40, 80);
    const jitterStormMs = integer(random, 80, 160);
    const highCurrentMs = integer(random, criticalOpportunity ? 220 : 100, criticalOpportunity ? 420 : 180);
    const settleMs = integer(random, 80, 160);

    const externalFaultPatch = criticalOpportunity
      ? {
          scenario: ELECTRICAL_SCENARIOS.EXTERNAL_FAULT,
          remoteMagnitudePct: range(random, 96.5, 103.5),
          remotePhaseDeg: range(random, -1.2, 1.2),
          ctSaturationPct: range(random, 0, 28),
          dcOffsetPct: range(random, 0, 18)
        }
      : {
          scenario: random() < 0.32 ? ELECTRICAL_SCENARIOS.LOAD_STEP : ELECTRICAL_SCENARIOS.THROUGH,
          remoteMagnitudePct: range(random, 98, 102),
          remotePhaseDeg: range(random, -0.5, 0.5),
          ctSaturationPct: 0,
          dcOffsetPct: 0
        };

    const phases = [
      phase('link-flap', flapMs, {
        ...cleanPatch(),
        scenario: ELECTRICAL_SCENARIOS.THROUGH,
        asymmetryMs: moderateAsymmetryMs,
        jitterMs: range(random, 2.2, 4.8),
        packetLossPct: range(random, 24, 48),
        burstLossPct: range(random, 35, 72),
        burstLengthFrames: integer(random, 3, 8),
        duplicatePct: range(random, 5, 24),
        reorderPct: range(random, 12, 38),
        reorderExtraDelayMs: range(random, 4, 12),
        reorderBufferFrames: integer(random, 1, 4),
        maxConsecutiveLossFrames: integer(random, 2, 4),
        maxReceiverQueueFrames: integer(random, 5, 9)
      }, { communicationStress: true }),
      phase('partial-recovery', partialRecoveryMs, {
        ...cleanPatch(),
        scenario: ELECTRICAL_SCENARIOS.THROUGH,
        asymmetryMs: moderateAsymmetryMs,
        jitterMs: range(random, 0.55, 1.35),
        packetLossPct: range(random, 0.5, 3.2),
        burstLossPct: range(random, 0, 5),
        duplicatePct: range(random, 0, 10),
        reorderPct: range(random, 0, 12),
        reorderExtraDelayMs: range(random, 2, 6)
      }, { communicationStress: true }),
      phase('deceptive-recovery', deceptiveRecoveryMs, {
        ...cleanPatch(),
        scenario: ELECTRICAL_SCENARIOS.THROUGH,
        asymmetryMs: range(random, -0.22, 0.22),
        jitterMs: range(random, 0.02, 0.12)
      }, { recoveryOpportunity: true }),
      phase('asymmetric-route-flip', routeFlipMs, {
        ...cleanPatch(),
        scenario: ELECTRICAL_SCENARIOS.THROUGH,
        asymmetryMs: stressAsymmetryMs,
        jitterMs: range(random, 0.08, 0.28)
      }, { alignmentShock: true }),
      phase('jitter-storm', jitterStormMs, {
        ...cleanPatch(),
        scenario: ELECTRICAL_SCENARIOS.THROUGH,
        asymmetryMs: stressAsymmetryMs,
        jitterMs: range(random, criticalOpportunity ? 1.15 : 0.65, criticalOpportunity ? 2.25 : 1.35),
        packetLossPct: range(random, 0, 0.8),
        duplicatePct: range(random, 0, 5),
        reorderPct: range(random, 0, 5),
        reorderExtraDelayMs: range(random, 1, 4)
      }, { communicationStress: true, alignmentShock: true }),
      phase('high-through-current-release', highCurrentMs, {
        ...cleanPatch(),
        ...externalFaultPatch,
        asymmetryMs: stressAsymmetryMs,
        jitterMs: range(random, 0.03, 0.16),
        harmonic3Pct: range(random, 0, criticalOpportunity ? 5 : 2),
        halfWaveAsymmetryPct: range(random, 0, criticalOpportunity ? 5 : 2)
      }, { highCurrent: criticalOpportunity, criticalOpportunity }),
      phase('post-event-settle', settleMs, {
        ...cleanPatch(),
        scenario: ELECTRICAL_SCENARIOS.THROUGH,
        asymmetryMs: range(random, -0.3, 0.3),
        jitterMs: range(random, 0.03, 0.12)
      })
    ];

    schedule.push({
      id: `EP-${String(index + 1).padStart(4, '0')}`,
      index,
      criticalOpportunity,
      stressAsymmetryMs: round(stressAsymmetryMs, 4),
      equivalentIdleMs: round(equivalentIdleMs, 2),
      equivalentExposureMsAtEnd: round(equivalentExposureMs, 2),
      phases
    });
  }

  return {
    seed,
    episodes,
    baselinePatch: cleanPatch(),
    equivalentExposureMs: round(equivalentExposureMs, 2),
    schedule
  };
}

function profileFrom(profileOrId) {
  if (typeof profileOrId === 'string') {
    const profile = PROFILE_MAP.get(profileOrId);
    if (!profile) throw new Error(`Unsupported stress profile: ${profileOrId}`);
    return profile;
  }
  if (!profileOrId?.id || !profileOrId?.algorithm) throw new Error('Invalid stress profile.');
  return profileOrId;
}

function createReplayAccumulator(schedule, profile, stepMs) {
  return {
    seed: schedule.seed,
    profileId: profile.id,
    profileLabel: profile.label,
    algorithm: profile.algorithm,
    securityPolicy: profile.securityPolicy,
    stepMs,
    totalFrames: 0,
    simulatedTimeMs: 0,
    operations: 0,
    firstTrip: null,
    previousOperate: false,
    previousPermissionBlocked: false,
    previousState: PROTECTION_STATES.NORMAL,
    permissionReopenCount: 0,
    stateTransitionCount: 0,
    secureEntryCount: 0,
    blockedEntryCount: 0,
    nearMissCount: 0,
    availableFrames: 0,
    hardInvalidFrames: 0,
    highCurrentFrames: 0,
    maxOperateRatioToActiveThreshold: 0,
    maxFalseMarginPu: Number.NEGATIVE_INFINITY,
    alignmentSquaredSum: 0,
    alignmentSamples: 0,
    postReopenAlignmentSquaredSum: 0,
    postReopenAlignmentSamples: 0,
    reopenObservationFrames: 0,
    lastTrustedAlignmentMs: 0,
    maxStaleCorrectionAgeMs: 0,
    reasonCounts: {},
    phaseCounts: {},
    episodeOperationCount: 0
  };
}

function compactFrameEvidence(frame) {
  return {
    protection: {
      state: frame.protection.state,
      permission: frame.protection.permission,
      decision: frame.protection.decision,
      operate: frame.protection.operate,
      tripAllowed: frame.protection.tripAllowed
    },
    differential: {
      validatedRmsPu: round(frame.differential.validatedRmsPu, 5),
      restraintRmsPu: round(frame.differential.restraintRmsPu, 5),
      pickupPu: round(frame.differential.pickupPu, 5),
      activeThresholdPu: round(frame.differential.activeThresholdPu, 5),
      marginPu: round(frame.differential.marginPu, 5),
      directionCorrelation: round(frame.differential.directionCorrelation, 5),
      protectionValidFraction: round(frame.differential.protectionValidFraction, 5)
    },
    channel: {
      rttMs: round(frame.channel.rttMs, 5),
      rttJitterMs: round(frame.channel.rttJitterMs, 5),
      packetAgeMs: round(frame.channel.packetAgeMs, 5),
      sequenceGapCount: frame.channel.sequenceGapCount,
      maxConsecutiveLossFrames: frame.channel.maxConsecutiveLossFrames,
      duplicateFrames: frame.channel.duplicateFrames,
      reorderedFrames: frame.channel.reorderedFrames,
      lateFrames: frame.channel.lateFrames,
      queueOverflowFrames: frame.channel.queueOverflowFrames
    },
    alignment: {
      estimatedShiftMs: round(frame.alignment.estimatedShiftMs, 5),
      uncertaintyMs: round(frame.alignment.uncertaintyMs, 5),
      trackingCorrectionMs: round(frame.alignment.trackingCorrectionMs, 5)
    },
    confidence: {
      channel: round(frame.confidence.channel.score, 3),
      alignment: round(frame.confidence.alignment.score, 3),
      waveform: round(frame.confidence.waveform.score, 3),
      hardInvalid: frame.confidence.hardInvalid,
      reasons: frame.confidence.reasons
    },
    evaluatorOnly: {
      groundTruthResidualMs: round(frame.diagnostics?.groundTruthResidualMs, 5)
    }
  };
}

function observeStressFrame(accumulator, frame, context) {
  accumulator.totalFrames += 1;
  accumulator.simulatedTimeMs += accumulator.stepMs;
  accumulator.phaseCounts[context.phase.name] = (accumulator.phaseCounts[context.phase.name] ?? 0) + 1;

  const blocked = frame.protection.permission === 'BLOCKED';
  if (accumulator.previousPermissionBlocked && !blocked) {
    accumulator.permissionReopenCount += 1;
    accumulator.reopenObservationFrames = 10;
  }
  accumulator.previousPermissionBlocked = blocked;

  if (frame.protection.state !== accumulator.previousState) {
    accumulator.stateTransitionCount += 1;
    if (frame.protection.state === PROTECTION_STATES.SECURE) accumulator.secureEntryCount += 1;
    if (frame.protection.state === PROTECTION_STATES.BLOCKED) accumulator.blockedEntryCount += 1;
    accumulator.previousState = frame.protection.state;
  }

  if (!blocked) accumulator.availableFrames += 1;
  if (frame.confidence.hardInvalid) accumulator.hardInvalidFrames += 1;
  if (context.phase.highCurrent) accumulator.highCurrentFrames += 1;

  const activeThreshold = Math.max(0.01, Number(frame.differential.activeThresholdPu ?? frame.differential.pickupPu ?? 0.01));
  const validatedIdiff = Number(frame.differential.validatedRmsPu ?? 0);
  const activeRatio = validatedIdiff / activeThreshold;
  accumulator.maxOperateRatioToActiveThreshold = Math.max(accumulator.maxOperateRatioToActiveThreshold, activeRatio);
  accumulator.maxFalseMarginPu = Math.max(accumulator.maxFalseMarginPu, validatedIdiff - activeThreshold);
  if (frame.protection.tripAllowed && activeRatio >= 0.85 && activeRatio < 1) accumulator.nearMissCount += 1;

  const residual = Number(frame.diagnostics?.groundTruthResidualMs);
  if (Number.isFinite(residual)) {
    accumulator.alignmentSquaredSum += residual * residual;
    accumulator.alignmentSamples += 1;
    if (accumulator.reopenObservationFrames > 0) {
      accumulator.postReopenAlignmentSquaredSum += residual * residual;
      accumulator.postReopenAlignmentSamples += 1;
    }
  }
  if (accumulator.reopenObservationFrames > 0) accumulator.reopenObservationFrames -= 1;

  const trustedAlignment =
    !frame.confidence.hardInvalid &&
    frame.confidence.channel.score >= 82 &&
    frame.confidence.alignment.score >= 82 &&
    frame.differential.measuredEvidenceValid;
  if (trustedAlignment) accumulator.lastTrustedAlignmentMs = accumulator.simulatedTimeMs;
  const staleAgeMs = accumulator.simulatedTimeMs - accumulator.lastTrustedAlignmentMs;
  if (!blocked) accumulator.maxStaleCorrectionAgeMs = Math.max(accumulator.maxStaleCorrectionAgeMs, staleAgeMs);

  for (const reason of frame.confidence.reasons) {
    accumulator.reasonCounts[reason] = (accumulator.reasonCounts[reason] ?? 0) + 1;
  }

  const risingOperate = frame.protection.operate && !accumulator.previousOperate;
  accumulator.previousOperate = frame.protection.operate;
  if (risingOperate) {
    accumulator.operations += 1;
    accumulator.episodeOperationCount += 1;
    if (!accumulator.firstTrip) {
      accumulator.firstTrip = {
        episodeId: context.episode.id,
        episodeIndex: context.episode.index,
        phase: context.phase.name,
        phaseElapsedMs: context.phaseElapsedMs,
        simulatedTimeMs: accumulator.simulatedTimeMs,
        equivalentExposureMs: context.episode.equivalentExposureMsAtEnd,
        criticalOpportunity: context.episode.criticalOpportunity,
        stressAsymmetryMs: context.episode.stressAsymmetryMs,
        evidence: compactFrameEvidence(frame)
      };
    }
  }
}

function runStressPhase(simulator, accumulator, episode, stressPhase, stepMs) {
  simulator.setConfig(stressPhase.patch);
  const steps = Math.max(1, Math.ceil(stressPhase.durationMs / stepMs));
  for (let index = 0; index < steps; index += 1) {
    const frame = simulator.step(stepMs);
    observeStressFrame(accumulator, frame, {
      episode,
      phase: stressPhase,
      phaseElapsedMs: Math.min(stressPhase.durationMs, (index + 1) * stepMs)
    });
  }
}

export function runLongHorizonReplay(schedule, profileOrId, options = {}) {
  const profile = profileFrom(profileOrId);
  const stepMs = Math.max(5, Number(options.stepMs ?? DEFAULT_STRESS_OPTIONS.stepMs));
  const warmupMs = Math.max(100, Number(options.warmupMs ?? DEFAULT_STRESS_OPTIONS.warmupMs));
  const stopAfterFirstTrip = Boolean(options.stopAfterFirstTrip ?? DEFAULT_STRESS_OPTIONS.stopAfterFirstTrip);
  const initialConfig = {
    ...createDefaultConfig(),
    ...schedule.baselinePatch,
    ...profile.settings,
    seed: schedule.seed,
    algorithm: profile.algorithm,
    securityPolicy: profile.securityPolicy
  };
  const simulator = new Simulator(initialConfig);
  const accumulator = createReplayAccumulator(schedule, profile, stepMs);

  const warmupSteps = Math.ceil(warmupMs / stepMs);
  for (let index = 0; index < warmupSteps; index += 1) simulator.step(stepMs);
  accumulator.simulatedTimeMs += warmupSteps * stepMs;
  accumulator.lastTrustedAlignmentMs = accumulator.simulatedTimeMs;

  for (const episode of schedule.schedule) {
    accumulator.episodeOperationCount = 0;
    for (const stressPhase of episode.phases) {
      simulator.setConfig({
        ...stressPhase.patch,
        ...profile.settings,
        algorithm: profile.algorithm,
        securityPolicy: profile.securityPolicy
      });
      runStressPhase(simulator, accumulator, episode, stressPhase, stepMs);
      if (stopAfterFirstTrip && accumulator.firstTrip) break;
    }
    if (stopAfterFirstTrip && accumulator.firstTrip) break;
  }

  const totalFrames = Math.max(1, accumulator.totalFrames);
  return {
    seed: schedule.seed,
    profileId: profile.id,
    profileLabel: profile.label,
    algorithm: profile.algorithm,
    securityPolicy: profile.securityPolicy,
    episodesScheduled: schedule.episodes,
    episodesCompleted: accumulator.firstTrip && stopAfterFirstTrip
      ? accumulator.firstTrip.episodeIndex + 1
      : schedule.episodes,
    unwantedTrip: accumulator.operations > 0,
    operationCount: accumulator.operations,
    firstTrip: accumulator.firstTrip,
    episodesToFirstTrip: accumulator.firstTrip ? accumulator.firstTrip.episodeIndex + 1 : null,
    simulatedTimeToFirstTripMs: accumulator.firstTrip ? round(accumulator.firstTrip.simulatedTimeMs, 2) : null,
    equivalentHoursToFirstTrip: accumulator.firstTrip
      ? round(accumulator.firstTrip.equivalentExposureMs / 3_600_000, 4)
      : null,
    operationsPer1000Episodes: round(accumulator.operations / Math.max(1, schedule.episodes) * 1000, 5),
    permissionReopenCount: accumulator.permissionReopenCount,
    stateTransitionCount: accumulator.stateTransitionCount,
    secureEntryCount: accumulator.secureEntryCount,
    blockedEntryCount: accumulator.blockedEntryCount,
    nearMissCount: accumulator.nearMissCount,
    availabilityPct: round(accumulator.availableFrames / totalFrames * 100, 4),
    hardInvalidPct: round(accumulator.hardInvalidFrames / totalFrames * 100, 4),
    highCurrentExposureMs: accumulator.highCurrentFrames * stepMs,
    maxOperateRatioToActiveThreshold: round(accumulator.maxOperateRatioToActiveThreshold, 5),
    maxFalseMarginPu: round(accumulator.maxFalseMarginPu, 5),
    alignmentRmseMs: round(Math.sqrt(accumulator.alignmentSquaredSum / Math.max(1, accumulator.alignmentSamples)), 5),
    postReopenAlignmentRmseMs: round(
      Math.sqrt(accumulator.postReopenAlignmentSquaredSum / Math.max(1, accumulator.postReopenAlignmentSamples)),
      5
    ),
    maxStaleCorrectionAgeMs: round(accumulator.maxStaleCorrectionAgeMs, 2),
    reasonCounts: Object.fromEntries(Object.entries(accumulator.reasonCounts).sort((a, b) => b[1] - a[1])),
    phaseCounts: accumulator.phaseCounts
  };
}

function percentile(values, probability) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const position = (finite.length - 1) * clamp(probability, 0, 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return finite[lower];
  return finite[lower] + (finite[upper] - finite[lower]) * (position - lower);
}

function distribution(values) {
  const finite = values.filter(Number.isFinite);
  const mean = finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
  return {
    count: finite.length,
    mean: round(mean, 4),
    p50: round(percentile(finite, 0.5), 4),
    p95: round(percentile(finite, 0.95), 4),
    max: round(finite.length ? Math.max(...finite) : null, 4)
  };
}

function cumulativeFailureProbability(replays, episodes) {
  const checkpoints = Array.from(new Set([
    10,
    25,
    50,
    100,
    Math.max(1, Math.floor(episodes * 0.75)),
    episodes
  ].filter((value) => value <= episodes))).sort((a, b) => a - b);
  return checkpoints.map((checkpoint) => {
    const failures = replays.filter((replay) =>
      Number.isFinite(replay.episodesToFirstTrip) && replay.episodesToFirstTrip <= checkpoint
    ).length;
    return {
      episodes: checkpoint,
      failures,
      probabilityPct: round(replays.length ? failures / replays.length * 100 : 0, 4)
    };
  });
}

export function summarizeStressReplays(replays, profiles, episodes) {
  const summary = {};
  for (const profile of profiles) {
    const selected = replays.filter((replay) => replay.profileId === profile.id);
    const failed = selected.filter((replay) => replay.unwantedTrip);
    const totalOperations = selected.reduce((sum, replay) => sum + replay.operationCount, 0);
    summary[profile.id] = {
      label: profile.label,
      runs: selected.length,
      failedRuns: failed.length,
      failureProbabilityPct: round(selected.length ? failed.length / selected.length * 100 : 0, 4),
      totalOperations,
      unwantedOperationsPer1000Episodes: round(
        totalOperations / Math.max(1, selected.length * episodes) * 1000,
        5
      ),
      episodesToFirstTrip: distribution(failed.map((replay) => replay.episodesToFirstTrip)),
      equivalentHoursToFirstTrip: distribution(failed.map((replay) => replay.equivalentHoursToFirstTrip)),
      permissionReopenCount: distribution(selected.map((replay) => replay.permissionReopenCount)),
      stateTransitionCount: distribution(selected.map((replay) => replay.stateTransitionCount)),
      nearMissCount: distribution(selected.map((replay) => replay.nearMissCount)),
      availabilityPct: distribution(selected.map((replay) => replay.availabilityPct)),
      postReopenAlignmentRmseMs: distribution(selected.map((replay) => replay.postReopenAlignmentRmseMs)),
      maxStaleCorrectionAgeMs: distribution(selected.map((replay) => replay.maxStaleCorrectionAgeMs)),
      maxOperateRatioToActiveThreshold: distribution(selected.map((replay) => replay.maxOperateRatioToActiveThreshold)),
      cumulativeFailureProbability: cumulativeFailureProbability(selected, episodes)
    };
  }
  return summary;
}

export function runLongHorizonStressCampaign(options = {}) {
  const merged = { ...DEFAULT_STRESS_OPTIONS, ...options };
  const seedCount = Math.max(1, Math.floor(Number(merged.seeds)));
  const episodes = Math.max(1, Math.floor(Number(merged.episodes)));
  const requestedProfiles = Array.from(merged.profiles ?? DEFAULT_STRESS_OPTIONS.profiles);
  const profiles = requestedProfiles.map(profileFrom);
  const schedules = Array.from({ length: seedCount }, (_, index) =>
    generateStressSchedule(runSeed(Number(merged.seed), index), { episodes })
  );
  const replays = [];

  for (const schedule of schedules) {
    for (const profile of profiles) {
      replays.push(runLongHorizonReplay(schedule, profile, merged));
    }
  }

  const failures = replays
    .filter((replay) => replay.unwantedTrip)
    .map((replay) => ({
      seed: replay.seed,
      profileId: replay.profileId,
      episodesToFirstTrip: replay.episodesToFirstTrip,
      firstTrip: replay.firstTrip
    }));

  return {
    format: 'line-differential-relay-lab-long-horizon-stress',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    campaign: {
      masterSeed: Number(merged.seed),
      seeds: seedCount,
      episodesPerSeed: episodes,
      profiles: profiles.map((profile) => profile.id),
      replayCount: replays.length,
      totalEpisodeExposures: replays.length * episodes,
      stepMs: Number(merged.stepMs),
      methodology: 'Stateful accelerated exposure: one simulator instance persists across repeated link flaps, partial recovery, deceptive recovery, asymmetry shock, jitter storm, and high through-current release episodes.',
      accelerationNotice: 'Healthy idle intervals are compressed into equivalent exposure time. Protection timers and estimator state are advanced only through explicitly simulated stress phases.',
      safetyBoundary: 'No operation is forced. Ground truth is evaluator-only and cannot affect alignment, confidence, protection permission, Idiff, persistence, or trip.',
      vendorNotice: 'Profiles are generic research policies and do not reproduce or claim equivalence with any manufacturer relay algorithm.',
      certificationNotice: 'Extreme simulation evidence only; not relay certification or field reliability proof.'
    },
    summary: summarizeStressReplays(replays, profiles, episodes),
    failures,
    schedules: merged.includeReplayDetails ? schedules : undefined,
    replays: merged.includeReplayDetails ? replays : undefined
  };
}

function formatNumber(value, suffix = '') {
  return Number.isFinite(value) ? `${Number(value).toFixed(2)}${suffix}` : '—';
}

export function formatLongHorizonStressMarkdown(report) {
  const lines = [
    '# Accelerated Long-Horizon 87L Stress Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Campaign: **${report.campaign.seeds} seeds**, **${report.campaign.episodesPerSeed} stateful episodes per seed**, **${report.campaign.replayCount} policy replays**.`,
    '',
    '> No trip is forced. Every operation is produced by the normal protection calculation and state machine.',
    '',
    '> Generic research profiles only. This benchmark does not reproduce or benchmark any manufacturer proprietary algorithm.',
    '',
    '## Rare-event security',
    '',
    '| Profile | Failed runs | Failure probability | Unwanted operations / 1,000 episodes | Median episodes to first trip | P95 episodes to first trip | Mean equivalent hours to first trip |',
    '|---|---:|---:|---:|---:|---:|---:|'
  ];

  for (const profileId of report.campaign.profiles) {
    const result = report.summary[profileId];
    lines.push(
      `| ${result.label} | ${result.failedRuns}/${result.runs} | ${formatNumber(result.failureProbabilityPct, '%')} | ${formatNumber(result.unwantedOperationsPer1000Episodes)} | ${formatNumber(result.episodesToFirstTrip.p50)} | ${formatNumber(result.episodesToFirstTrip.p95)} | ${formatNumber(result.equivalentHoursToFirstTrip.mean, ' h')} |`
    );
  }

  lines.push(
    '',
    '## Recovery churn and alignment exposure',
    '',
    '| Profile | Mean permission reopen count | Mean state transitions | Mean near misses | Mean availability | Mean post-reopen alignment RMSE | P95 stale-correction age | Maximum operate ratio |',
    '|---|---:|---:|---:|---:|---:|---:|---:|'
  );

  for (const profileId of report.campaign.profiles) {
    const result = report.summary[profileId];
    lines.push(
      `| ${result.label} | ${formatNumber(result.permissionReopenCount.mean)} | ${formatNumber(result.stateTransitionCount.mean)} | ${formatNumber(result.nearMissCount.mean)} | ${formatNumber(result.availabilityPct.mean, '%')} | ${formatNumber(result.postReopenAlignmentRmseMs.mean, ' ms')} | ${formatNumber(result.maxStaleCorrectionAgeMs.p95, ' ms')} | ${formatNumber(result.maxOperateRatioToActiveThreshold.max)} |`
    );
  }

  lines.push('', '## Cumulative failure probability', '');
  for (const profileId of report.campaign.profiles) {
    const result = report.summary[profileId];
    lines.push(`### ${result.label}`, '', '| Episode exposure | Failed runs | Cumulative probability |', '|---:|---:|---:|');
    for (const point of result.cumulativeFailureProbability) {
      lines.push(`| ${point.episodes} | ${point.failures}/${result.runs} | ${formatNumber(point.probabilityPct, '%')} |`);
    }
    lines.push('');
  }

  lines.push(
    '## Interpretation',
    '',
    '- A failure is any 87L operation during through current, load step, or external through-fault exposure.',
    '- Episodes preserve estimator, receiver, protection-state, persistence, and recovery history; the simulator is not reset between episodes.',
    '- A deceptive recovery intentionally restores packet quality before applying a one-way asymmetry shock whose RTT can still appear plausible.',
    '- Equivalent hours are an exposure index derived from compressed healthy intervals, not wall-clock simulation time.',
    '- A zero count means no counterexample was found within this finite search budget, not proof of universal security.',
    ''
  );

  return `${lines.join('\n')}\n`;
}
