import { ALGORITHM_MODES, ELECTRICAL_SCENARIOS, PROTECTION_STATES, createDefaultConfig } from '../engine/constants.js';
import { hash32, mulberry32 } from '../engine/random.js';
import { Simulator } from '../engine/simulation.js';

export const DEFAULT_VALIDATION_ALGORITHMS = Object.freeze([
  ALGORITHM_MODES.PING_PONG,
  ALGORITHM_MODES.SECURE_WINDOW,
  ALGORITHM_MODES.SMART_TRACKING
]);

export const DEFAULT_CAMPAIGN_OPTIONS = Object.freeze({
  cases: 120,
  seed: 61850,
  stepMs: 20,
  warmupMs: 240,
  eventMs: 640,
  recoveryMs: 420,
  algorithms: DEFAULT_VALIDATION_ALGORITHMS,
  includeCaseDetails: true
});

const CASE_FAMILIES = Object.freeze([
  { id: 'through-communication', scenario: ELECTRICAL_SCENARIOS.THROUGH, expectedTrip: false },
  { id: 'external-fault', scenario: ELECTRICAL_SCENARIOS.EXTERNAL_FAULT, expectedTrip: false },
  { id: 'internal-fault', scenario: ELECTRICAL_SCENARIOS.INTERNAL_FAULT, expectedTrip: true },
  { id: 'ct-error', scenario: ELECTRICAL_SCENARIOS.CT_ERROR, expectedTrip: false },
  { id: 'load-step', scenario: ELECTRICAL_SCENARIOS.LOAD_STEP, expectedTrip: false }
]);

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

function caseSeed(masterSeed, index) {
  return (hash32(masterSeed + Math.imul(index + 1, 0x45d9f3b)) % 2_147_483_646) + 1;
}

function severityRanges(severity) {
  if (severity === 'mild') {
    return {
      jitter: [0.03, 0.45],
      packetLoss: [0, 0.8],
      burstLoss: [0, 1.2],
      corruption: [0, 0.05],
      duplicate: [0, 8],
      reorder: [0, 8],
      reorderDelay: [0.5, 3],
      asymmetry: [-1.5, 1.5]
    };
  }
  if (severity === 'severe') {
    return {
      jitter: [0.8, 2.8],
      packetLoss: [2, 8],
      burstLoss: [1.5, 6],
      corruption: [0, 0.8],
      duplicate: [8, 35],
      reorder: [10, 45],
      reorderDelay: [4, 11],
      asymmetry: [-6.5, 6.5]
    };
  }
  return {
    jitter: [0.25, 1.35],
    packetLoss: [0.4, 3.5],
    burstLoss: [0.3, 3],
    corruption: [0, 0.25],
    duplicate: [2, 20],
    reorder: [3, 25],
    reorderDelay: [2, 7],
    asymmetry: [-4, 4]
  };
}

function cleanCommunicationPatch(base) {
  return {
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    baseDelayMs: base.baseDelayMs,
    asymmetryMs: 0,
    jitterMs: 0.04,
    packetLossPct: 0,
    burstLossPct: 0,
    burstLengthFrames: base.burstLengthFrames,
    corruptionPct: 0,
    duplicatePct: 0,
    reorderPct: 0,
    reorderExtraDelayMs: base.reorderExtraDelayMs,
    reorderBufferFrames: base.reorderBufferFrames,
    packetSamples: base.packetSamples,
    packetSerializationMs: base.packetSerializationMs,
    routeChangeAtMs: base.routeChangeAtMs,
    routeStepDeltaMs: 0,
    routeRampMs: 0,
    maxConsecutiveLossFrames: base.maxConsecutiveLossFrames,
    maxReceiverQueueFrames: base.maxReceiverQueueFrames,
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

export function generateValidationCase(index, options = {}) {
  const masterSeed = Number(options.seed ?? DEFAULT_CAMPAIGN_OPTIONS.seed);
  const warmupMs = Number(options.warmupMs ?? DEFAULT_CAMPAIGN_OPTIONS.warmupMs);
  const eventMs = Number(options.eventMs ?? DEFAULT_CAMPAIGN_OPTIONS.eventMs);
  const seed = caseSeed(masterSeed, index);
  const random = mulberry32(hash32(seed));
  const family = CASE_FAMILIES[index % CASE_FAMILIES.length];
  const severity = pick(random, ['mild', 'moderate', 'moderate', 'severe']);
  const limits = severityRanges(severity);
  const routeEnabled = random() < (severity === 'mild' ? 0.3 : 0.68);
  const routeRampMs = routeEnabled ? pick(random, [0, 20, 60, 120]) : 0;
  const packetSamples = pick(random, [4, 8, 8, 16]);
  const reorderBufferFrames = integer(random, 0, severity === 'severe' ? 5 : 3);
  const maxReceiverQueueFrames = Math.max(
    reorderBufferFrames + 1,
    integer(random, severity === 'severe' ? 2 : 4, 10)
  );

  const eventPatch = {
    seed,
    scenario: family.scenario,
    baseDelayMs: range(random, 1, 8),
    asymmetryMs: range(random, ...limits.asymmetry),
    jitterMs: range(random, ...limits.jitter),
    packetLossPct: range(random, ...limits.packetLoss),
    burstLossPct: range(random, ...limits.burstLoss),
    burstLengthFrames: integer(random, 1, severity === 'severe' ? 5 : 3),
    corruptionPct: range(random, ...limits.corruption),
    duplicatePct: range(random, ...limits.duplicate),
    reorderPct: range(random, ...limits.reorder),
    reorderExtraDelayMs: range(random, ...limits.reorderDelay),
    reorderBufferFrames,
    packetSamples,
    packetSerializationMs: range(random, 0.04, 0.9),
    routeChangeAtMs: warmupMs + range(random, 50, Math.max(70, eventMs - 100)),
    routeStepDeltaMs: routeEnabled ? range(random, -4.5, 5.5) : 0,
    routeRampMs,
    maxConsecutiveLossFrames: integer(random, 2, severity === 'severe' ? 6 : 4),
    maxReceiverQueueFrames,
    packetAbsoluteAgeMs: range(random, severity === 'severe' ? 12 : 16, 34),
    clockOffsetMs: range(random, -0.8, 0.8),
    clockDriftPpm: range(random, -45, 45),
    remoteMagnitudePct: 100,
    remotePhaseDeg: 0,
    halfWaveAsymmetryPct: 0,
    harmonic3Pct: 0,
    dcOffsetPct: 0,
    ctSaturationPct: 0
  };

  if (family.scenario === ELECTRICAL_SCENARIOS.EXTERNAL_FAULT) {
    eventPatch.remoteMagnitudePct = range(random, 92, 108);
    eventPatch.remotePhaseDeg = range(random, -2.5, 2.5);
    eventPatch.ctSaturationPct = range(random, 0, severity === 'severe' ? 85 : 55);
    eventPatch.dcOffsetPct = range(random, 0, 25);
  } else if (family.scenario === ELECTRICAL_SCENARIOS.CT_ERROR) {
    eventPatch.remoteMagnitudePct = range(random, 82, 112);
    eventPatch.remotePhaseDeg = range(random, -6, 6);
    eventPatch.halfWaveAsymmetryPct = range(random, 2, 22);
    eventPatch.harmonic3Pct = range(random, 0, 10);
    eventPatch.dcOffsetPct = range(random, 0, 20);
  } else if (family.scenario === ELECTRICAL_SCENARIOS.INTERNAL_FAULT) {
    eventPatch.remoteMagnitudePct = range(random, 88, 112);
    eventPatch.remotePhaseDeg = range(random, -3, 3);
    // Keep most internal-fault cases at a usable channel quality so missed-trip
    // metrics are not dominated by deliberate hard-invalid veto conditions.
    eventPatch.packetLossPct *= 0.62;
    eventPatch.burstLossPct *= 0.55;
    eventPatch.corruptionPct *= 0.35;
  } else if (family.scenario === ELECTRICAL_SCENARIOS.LOAD_STEP) {
    eventPatch.remoteMagnitudePct = range(random, 96, 104);
    eventPatch.remotePhaseDeg = range(random, -1.5, 1.5);
  }

  const baselinePatch = cleanCommunicationPatch(eventPatch);
  const recoveryPatch = { ...baselinePatch, scenario: ELECTRICAL_SCENARIOS.THROUGH };

  return {
    id: `MC-${String(index + 1).padStart(4, '0')}`,
    index,
    seed,
    family: family.id,
    severity,
    scenario: family.scenario,
    expectedTrip: family.expectedTrip,
    baselinePatch,
    eventPatch,
    recoveryPatch
  };
}

function createRunAccumulator(testCase, algorithm, timing) {
  return {
    caseId: testCase.id,
    caseSeed: testCase.seed,
    family: testCase.family,
    severity: testCase.severity,
    scenario: testCase.scenario,
    algorithm,
    expectedTrip: testCase.expectedTrip,
    timing,
    firstOperateMs: null,
    firstWatchMs: null,
    firstSecureMs: null,
    firstBlockedMs: null,
    recoveryToNormalMs: null,
    eventFrames: 0,
    recoveryFrames: 0,
    eligibleFrames: 0,
    maxConsecutiveEligibleFrames: 0,
    currentConsecutiveEligibleFrames: 0,
    availableFrames: 0,
    tripAllowedFrames: 0,
    secureFrames: 0,
    blockedFrames: 0,
    hardInvalidFrames: 0,
    alignmentSquaredSum: 0,
    alignmentSamples: 0,
    alignmentMaxAbsMs: 0,
    uncertaintySumMs: 0,
    predictionSum: 0,
    predictionMax: 0,
    ambiguousFrames: 0,
    heldMeasurementFrames: 0,
    routeTransitionFrames: 0,
    packetMaxima: {
      lossPct: 0,
      sequenceGaps: 0,
      consecutiveLossFrames: 0,
      duplicateFrames: 0,
      reorderedFrames: 0,
      lateFrames: 0,
      queueOverflowFrames: 0,
      maxReorderDepth: 0,
      packetAgeMs: 0
    },
    reasonCounts: {}
  };
}

function observeFrame(accumulator, frame, phase, phaseElapsedMs) {
  const state = frame.protection.state;
  if (phase !== 'warmup' && frame.protection.operate && accumulator.firstOperateMs === null) {
    accumulator.firstOperateMs = phase === 'event'
      ? phaseElapsedMs
      : accumulator.timing.eventMs + phaseElapsedMs;
  }

  if (phase === 'event') {
    accumulator.eventFrames += 1;
    if (state === PROTECTION_STATES.WATCH && accumulator.firstWatchMs === null) accumulator.firstWatchMs = phaseElapsedMs;
    if (state === PROTECTION_STATES.SECURE && accumulator.firstSecureMs === null) accumulator.firstSecureMs = phaseElapsedMs;
    if (state === PROTECTION_STATES.BLOCKED && accumulator.firstBlockedMs === null) accumulator.firstBlockedMs = phaseElapsedMs;

    const eligible = frame.differential.measuredEvidenceValid && !frame.confidence.hardInvalid;
    if (eligible) {
      accumulator.eligibleFrames += 1;
      accumulator.currentConsecutiveEligibleFrames += 1;
      accumulator.maxConsecutiveEligibleFrames = Math.max(
        accumulator.maxConsecutiveEligibleFrames,
        accumulator.currentConsecutiveEligibleFrames
      );
    } else {
      accumulator.currentConsecutiveEligibleFrames = 0;
    }

    if (frame.protection.permission !== 'BLOCKED') accumulator.availableFrames += 1;
    if (frame.protection.tripAllowed) accumulator.tripAllowedFrames += 1;
    if (state === PROTECTION_STATES.SECURE) accumulator.secureFrames += 1;
    if (state === PROTECTION_STATES.BLOCKED || state === PROTECTION_STATES.RECOVERY) accumulator.blockedFrames += 1;
    if (frame.confidence.hardInvalid) accumulator.hardInvalidFrames += 1;

    const residual = Number(frame.diagnostics?.groundTruthResidualMs);
    if (Number.isFinite(residual)) {
      accumulator.alignmentSquaredSum += residual * residual;
      accumulator.alignmentSamples += 1;
      accumulator.alignmentMaxAbsMs = Math.max(accumulator.alignmentMaxAbsMs, Math.abs(residual));
    }
    accumulator.uncertaintySumMs += Number(frame.alignment?.uncertaintyMs ?? 0);
    const predicted = Number(frame.alignment?.predictedFraction ?? 0);
    accumulator.predictionSum += predicted;
    accumulator.predictionMax = Math.max(accumulator.predictionMax, predicted);
    if (frame.confidence.reasons.includes('TRACKING_AMBIGUOUS')) accumulator.ambiguousFrames += 1;
    if (frame.confidence.reasons.includes('TRACKING_MEASUREMENT_HELD')) accumulator.heldMeasurementFrames += 1;
    if (frame.channel.routeTransitionActive) accumulator.routeTransitionFrames += 1;

    const packet = accumulator.packetMaxima;
    packet.lossPct = Math.max(packet.lossPct, Number(frame.channel.lossPct ?? 0));
    packet.sequenceGaps = Math.max(packet.sequenceGaps, Number(frame.channel.sequenceGapCount ?? 0));
    packet.consecutiveLossFrames = Math.max(packet.consecutiveLossFrames, Number(frame.channel.maxConsecutiveLossFrames ?? 0));
    packet.duplicateFrames = Math.max(packet.duplicateFrames, Number(frame.channel.duplicateFrames ?? 0));
    packet.reorderedFrames = Math.max(packet.reorderedFrames, Number(frame.channel.reorderedFrames ?? 0));
    packet.lateFrames = Math.max(packet.lateFrames, Number(frame.channel.lateFrames ?? 0));
    packet.queueOverflowFrames = Math.max(packet.queueOverflowFrames, Number(frame.channel.queueOverflowFrames ?? 0));
    packet.maxReorderDepth = Math.max(packet.maxReorderDepth, Number(frame.channel.maxReorderDepth ?? 0));
    packet.packetAgeMs = Math.max(packet.packetAgeMs, Number(frame.channel.packetAgeMs ?? 0));

    for (const reason of frame.confidence.reasons) {
      accumulator.reasonCounts[reason] = (accumulator.reasonCounts[reason] ?? 0) + 1;
    }
  } else if (phase === 'recovery') {
    accumulator.recoveryFrames += 1;
    if (
      accumulator.recoveryToNormalMs === null &&
      state === PROTECTION_STATES.NORMAL &&
      !frame.confidence.hardInvalid
    ) accumulator.recoveryToNormalMs = phaseElapsedMs;
  }
}

function runPhase(simulator, durationMs, stepMs, phase, accumulator) {
  const steps = Math.ceil(durationMs / stepMs);
  for (let index = 0; index < steps; index += 1) {
    const frame = simulator.step(stepMs);
    observeFrame(accumulator, frame, phase, Math.min(durationMs, (index + 1) * stepMs));
  }
}

export function runValidationCase(testCase, algorithm, options = {}) {
  const timing = {
    stepMs: Number(options.stepMs ?? DEFAULT_CAMPAIGN_OPTIONS.stepMs),
    warmupMs: Number(options.warmupMs ?? DEFAULT_CAMPAIGN_OPTIONS.warmupMs),
    eventMs: Number(options.eventMs ?? DEFAULT_CAMPAIGN_OPTIONS.eventMs),
    recoveryMs: Number(options.recoveryMs ?? DEFAULT_CAMPAIGN_OPTIONS.recoveryMs)
  };
  const initialConfig = {
    ...createDefaultConfig(),
    ...testCase.baselinePatch,
    seed: testCase.seed,
    algorithm
  };
  const simulator = new Simulator(initialConfig);
  const accumulator = createRunAccumulator(testCase, algorithm, timing);

  runPhase(simulator, timing.warmupMs, timing.stepMs, 'warmup', accumulator);
  simulator.setConfig({ ...testCase.eventPatch, algorithm });
  runPhase(simulator, timing.eventMs, timing.stepMs, 'event', accumulator);
  simulator.setConfig({ ...testCase.recoveryPatch, algorithm });
  runPhase(simulator, timing.recoveryMs, timing.stepMs, 'recovery', accumulator);

  const eventFrames = Math.max(1, accumulator.eventFrames);
  const eligibleFraction = accumulator.eligibleFrames / eventFrames;
  const dependabilityEligible = testCase.expectedTrip &&
    eligibleFraction >= 0.35 &&
    accumulator.maxConsecutiveEligibleFrames >= 3;
  const operatedDuringEvent = accumulator.firstOperateMs !== null && accumulator.firstOperateMs <= timing.eventMs;
  const unwantedTrip = !testCase.expectedTrip && accumulator.firstOperateMs !== null;
  const missedEligibleTrip = dependabilityEligible && !operatedDuringEvent;

  return {
    caseId: accumulator.caseId,
    caseSeed: accumulator.caseSeed,
    family: accumulator.family,
    severity: accumulator.severity,
    scenario: accumulator.scenario,
    algorithm,
    expectedTrip: testCase.expectedTrip,
    dependabilityEligible,
    operated: accumulator.firstOperateMs !== null,
    operatedDuringEvent,
    unwantedTrip,
    missedEligibleTrip,
    tripOperatingTimeMs: operatedDuringEvent ? round(accumulator.firstOperateMs, 2) : null,
    lateTrip: accumulator.firstOperateMs !== null && accumulator.firstOperateMs > timing.eventMs,
    firstWatchMs: round(accumulator.firstWatchMs, 2),
    firstSecureMs: round(accumulator.firstSecureMs, 2),
    firstBlockedMs: round(accumulator.firstBlockedMs, 2),
    recoveryToNormalMs: round(accumulator.recoveryToNormalMs, 2),
    eligibleFraction: round(eligibleFraction, 5),
    availabilityPct: round((accumulator.availableFrames / eventFrames) * 100, 3),
    tripAllowedPct: round((accumulator.tripAllowedFrames / eventFrames) * 100, 3),
    secureTimeMs: accumulator.secureFrames * timing.stepMs,
    blockedTimeMs: accumulator.blockedFrames * timing.stepMs,
    hardInvalidTimeMs: accumulator.hardInvalidFrames * timing.stepMs,
    alignmentRmseMs: round(Math.sqrt(accumulator.alignmentSquaredSum / Math.max(1, accumulator.alignmentSamples)), 5),
    alignmentMaxAbsMs: round(accumulator.alignmentMaxAbsMs, 5),
    meanEstimatedUncertaintyMs: round(accumulator.uncertaintySumMs / eventFrames, 5),
    meanPredictedFraction: round(accumulator.predictionSum / eventFrames, 6),
    maxPredictedFraction: round(accumulator.predictionMax, 6),
    ambiguousFrames: accumulator.ambiguousFrames,
    heldMeasurementFrames: accumulator.heldMeasurementFrames,
    routeTransitionFrames: accumulator.routeTransitionFrames,
    packetMaxima: Object.fromEntries(
      Object.entries(accumulator.packetMaxima).map(([key, value]) => [key, round(value, 5)])
    ),
    reasonCounts: accumulator.reasonCounts
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

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function metricDistribution(values) {
  const finite = values.filter(Number.isFinite);
  return {
    count: finite.length,
    mean: round(mean(finite), 4),
    p50: round(percentile(finite, 0.5), 4),
    p95: round(percentile(finite, 0.95), 4),
    max: round(finite.length ? Math.max(...finite) : null, 4)
  };
}

export function summarizeValidationRuns(runs, algorithms = DEFAULT_VALIDATION_ALGORITHMS) {
  const summary = {};
  for (const algorithm of algorithms) {
    const selected = runs.filter((run) => run.algorithm === algorithm);
    const security = selected.filter((run) => !run.expectedTrip);
    const internal = selected.filter((run) => run.expectedTrip);
    const eligibleInternal = internal.filter((run) => run.dependabilityEligible);
    const reasonCounts = {};
    for (const run of selected) {
      for (const [reason, count] of Object.entries(run.reasonCounts)) {
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + count;
      }
    }

    const unwantedTrips = security.filter((run) => run.unwantedTrip).length;
    const eligibleTrips = eligibleInternal.filter((run) => run.operatedDuringEvent).length;
    const allInternalTrips = internal.filter((run) => run.operatedDuringEvent).length;

    summary[algorithm] = {
      cases: selected.length,
      securityCases: security.length,
      unwantedTrips,
      unwantedTripRatePct: round(security.length ? unwantedTrips / security.length * 100 : 0, 4),
      internalCases: internal.length,
      dependabilityEligibleCases: eligibleInternal.length,
      eligibleInternalTrips: eligibleTrips,
      missedEligibleTrips: eligibleInternal.length - eligibleTrips,
      eligibleDependabilityPct: round(eligibleInternal.length ? eligibleTrips / eligibleInternal.length * 100 : 0, 4),
      allInternalTripPct: round(internal.length ? allInternalTrips / internal.length * 100 : 0, 4),
      communicationInhibitedInternalCases: internal.length - eligibleInternal.length,
      tripOperatingTimeMs: metricDistribution(
        eligibleInternal.filter((run) => run.operatedDuringEvent).map((run) => run.tripOperatingTimeMs)
      ),
      timeToSecureMs: metricDistribution(selected.map((run) => run.firstSecureMs)),
      timeToBlockMs: metricDistribution(selected.map((run) => run.firstBlockedMs)),
      recoveryToNormalMs: metricDistribution(selected.map((run) => run.recoveryToNormalMs)),
      availabilityPct: metricDistribution(selected.map((run) => run.availabilityPct)),
      alignmentRmseMs: metricDistribution(selected.map((run) => run.alignmentRmseMs)),
      alignmentMaxAbsMs: metricDistribution(selected.map((run) => run.alignmentMaxAbsMs)),
      estimatedUncertaintyMs: metricDistribution(selected.map((run) => run.meanEstimatedUncertaintyMs)),
      predictedFraction: metricDistribution(selected.map((run) => run.meanPredictedFraction)),
      ambiguousFrames: selected.reduce((sum, run) => sum + run.ambiguousFrames, 0),
      heldMeasurementFrames: selected.reduce((sum, run) => sum + run.heldMeasurementFrames, 0),
      reasonCounts: Object.fromEntries(Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]))
    };
  }
  return summary;
}

export function runMonteCarloCampaign(options = {}) {
  const merged = { ...DEFAULT_CAMPAIGN_OPTIONS, ...options };
  const algorithms = Array.from(merged.algorithms ?? DEFAULT_VALIDATION_ALGORITHMS);
  const cases = Math.max(1, Math.floor(Number(merged.cases)));
  const testCases = Array.from({ length: cases }, (_, index) => generateValidationCase(index, merged));
  const runs = [];

  for (const testCase of testCases) {
    for (const algorithm of algorithms) runs.push(runValidationCase(testCase, algorithm, merged));
  }

  return {
    format: 'line-differential-relay-lab-monte-carlo',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    campaign: {
      seed: Number(merged.seed),
      cases,
      algorithms,
      stepMs: Number(merged.stepMs),
      warmupMs: Number(merged.warmupMs),
      eventMs: Number(merged.eventMs),
      recoveryMs: Number(merged.recoveryMs),
      replayCount: runs.length,
      safetyBoundary: 'Ground truth is read only by the post-frame evaluator and is never passed into alignment, confidence, permission, Idiff, or trip logic.',
      certificationNotice: 'Simulation evidence only; not a protection-relay certification or vendor-algorithm equivalence claim.'
    },
    summary: summarizeValidationRuns(runs, algorithms),
    cases: merged.includeCaseDetails ? testCases : undefined,
    runs: merged.includeCaseDetails ? runs : undefined
  };
}

function formatNumber(value, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : '—';
}

function algorithmLabel(algorithm) {
  return {
    [ALGORITHM_MODES.PING_PONG]: 'Conventional RTT/2',
    [ALGORITHM_MODES.SECURE_WINDOW]: 'Communication-supervised',
    [ALGORITHM_MODES.SMART_TRACKING]: 'Smart waveform-assisted',
    [ALGORITHM_MODES.GPS]: 'Absolute-time reference'
  }[algorithm] ?? algorithm;
}

export function formatMonteCarloMarkdown(report) {
  const lines = [
    '# Blind Monte Carlo Validation Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Campaign: **${report.campaign.cases} cases**, **${report.campaign.replayCount} deterministic replays**, seed **${report.campaign.seed}**.`,
    '',
    '> Ground truth is evaluator-only. It is never exposed to the algorithm under test or the protection decision path.',
    '',
    '> This report is simulation evidence, not relay certification and not a claim of equivalence to any manufacturer algorithm.',
    '',
    '## Security and dependability',
    '',
    '| Algorithm | Security cases | Unwanted trips | Unwanted-trip rate | Eligible internal cases | Missed eligible trips | Eligible dependability | Mean trip time | P95 trip time |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'
  ];

  for (const algorithm of report.campaign.algorithms) {
    const result = report.summary[algorithm];
    lines.push(
      `| ${algorithmLabel(algorithm)} | ${result.securityCases} | ${result.unwantedTrips} | ${formatNumber(result.unwantedTripRatePct, '%')} | ${result.dependabilityEligibleCases} | ${result.missedEligibleTrips} | ${formatNumber(result.eligibleDependabilityPct, '%')} | ${formatNumber(result.tripOperatingTimeMs.mean, ' ms')} | ${formatNumber(result.tripOperatingTimeMs.p95, ' ms')} |`
    );
  }

  lines.push(
    '',
    '## Timing, availability, and alignment',
    '',
    '| Algorithm | Mean availability | Mean time to secure | Mean time to block | Mean recovery | Mean alignment RMSE | P95 max alignment error | Mean predicted fraction | Ambiguous frames | Held measurements |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
  );

  for (const algorithm of report.campaign.algorithms) {
    const result = report.summary[algorithm];
    lines.push(
      `| ${algorithmLabel(algorithm)} | ${formatNumber(result.availabilityPct.mean, '%')} | ${formatNumber(result.timeToSecureMs.mean, ' ms')} | ${formatNumber(result.timeToBlockMs.mean, ' ms')} | ${formatNumber(result.recoveryToNormalMs.mean, ' ms')} | ${formatNumber(result.alignmentRmseMs.mean, ' ms')} | ${formatNumber(result.alignmentMaxAbsMs.p95, ' ms')} | ${formatNumber((result.predictedFraction.mean ?? 0) * 100, '%')} | ${result.ambiguousFrames} | ${result.heldMeasurementFrames} |`
    );
  }

  lines.push(
    '',
    '## Interpretation rules',
    '',
    '- **Unwanted trip:** any operation in a non-internal-fault replay.',
    '- **Dependability-eligible internal case:** measured-valid, non-hard-invalid evidence is available for at least 35% of the event with at least three consecutive eligible frames.',
    '- **Communication-inhibited internal case:** an internal fault where hard validity or measured coverage prevents a fair trip expectation; reported separately from missed eligible trips.',
    '- **Alignment error:** evaluator-only residual using simulator ground truth after each frame completes.',
    '- **Prediction:** tracking-buffer interpolation usage; predicted samples remain excluded from protection evidence.',
    ''
  );

  return `${lines.join('\n')}\n`;
}
