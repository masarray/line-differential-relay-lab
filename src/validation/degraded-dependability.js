import {
  ALGORITHM_MODES,
  ELECTRICAL_SCENARIOS,
  PROTECTION_STATES,
  createDefaultConfig
} from '../engine/constants.js';
import { hash32, mulberry32 } from '../engine/random.js';
import { Simulator } from '../engine/simulation.js';

export const DEPENDABILITY_PROFILE_IDS = Object.freeze({
  NORMAL_QUALIFIED: 'normal-qualified',
  SOFT_DEGRADED: 'soft-degraded',
  ROUTE_RECOVERY: 'route-recovery',
  HARD_BLOCK_RECOVERY: 'hard-block-recovery'
});

export const DEFAULT_DEPENDABILITY_OPTIONS = Object.freeze({
  seed: 87161850,
  cases: 32,
  stepMs: 20,
  faultMs: 360,
  includeCaseDetails: true
});

const PROFILE_SEQUENCE = Object.freeze([
  DEPENDABILITY_PROFILE_IDS.NORMAL_QUALIFIED,
  DEPENDABILITY_PROFILE_IDS.SOFT_DEGRADED,
  DEPENDABILITY_PROFILE_IDS.ROUTE_RECOVERY,
  DEPENDABILITY_PROFILE_IDS.HARD_BLOCK_RECOVERY
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function range(random, minimum, maximum) {
  return minimum + (maximum - minimum) * random();
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function caseSeed(masterSeed, index) {
  return (hash32(masterSeed + Math.imul(index + 1, 0x27d4eb2d)) % 2_147_483_646) + 1;
}

function cleanPatch(seed) {
  return {
    seed,
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    scenario: ELECTRICAL_SCENARIOS.THROUGH,
    frequencyHz: 50,
    baseDelayMs: 3,
    asymmetryMs: 0,
    jitterMs: 0.05,
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
    maxConsecutiveLossFrames: 6,
    maxReceiverQueueFrames: 12,
    packetAbsoluteAgeMs: 50,
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

function phase(name, durationMs, patch) {
  return { name, durationMs, patch };
}

function profilePhases(profileId, seed, random) {
  const clean = cleanPatch(seed);
  if (profileId === DEPENDABILITY_PROFILE_IDS.NORMAL_QUALIFIED) {
    return [phase('healthy-qualification', 360, clean)];
  }

  if (profileId === DEPENDABILITY_PROFILE_IDS.SOFT_DEGRADED) {
    const sign = random() < 0.5 ? -1 : 1;
    return [
      phase('healthy-qualification', 260, clean),
      phase('soft-degraded-evidence', 260, {
        ...clean,
        asymmetryMs: sign * range(random, 1.2, 2.6),
        jitterMs: range(random, 0.2, 0.5),
        packetLossPct: range(random, 0.1, 0.7),
        burstLossPct: range(random, 0, 0.8),
        duplicatePct: range(random, 0, 5),
        reorderPct: range(random, 0, 6),
        reorderExtraDelayMs: range(random, 1.5, 3.5),
        remoteMagnitudePct: range(random, 98, 102),
        remotePhaseDeg: range(random, -0.6, 0.6)
      })
    ];
  }

  if (profileId === DEPENDABILITY_PROFILE_IDS.ROUTE_RECOVERY) {
    const sign = random() < 0.5 ? -1 : 1;
    return [
      phase('healthy-qualification', 260, clean),
      phase('one-way-route-shock', 100, {
        ...clean,
        baseDelayMs: 6,
        asymmetryMs: sign * range(random, 4.2, 7.2),
        jitterMs: range(random, 0.25, 0.65),
        routeChangeAtMs: 0,
        routeStepDeltaMs: sign * range(random, 1.5, 3.5),
        routeRampMs: 40
      }),
      phase('bounded-route-recovery', 160, {
        ...clean,
        asymmetryMs: sign * range(random, 0.3, 1.1),
        jitterMs: range(random, 0.08, 0.22)
      })
    ];
  }

  return [
    phase('healthy-qualification', 260, clean),
    phase('hard-invalid-burst', 60, {
      ...clean,
      corruptionPct: 100,
      packetLossPct: 35,
      burstLossPct: 60,
      burstLengthFrames: 6,
      maxConsecutiveLossFrames: 2
    }),
    phase('measured-recovery', 100, {
      ...clean,
      asymmetryMs: range(random, -0.7, 0.7),
      jitterMs: range(random, 0.08, 0.2)
    })
  ];
}

export function generateDependabilityCase(index, options = {}) {
  const masterSeed = Number(options.seed ?? DEFAULT_DEPENDABILITY_OPTIONS.seed);
  const seed = caseSeed(masterSeed, index);
  const random = mulberry32(hash32(seed));
  const profileId = PROFILE_SEQUENCE[index % PROFILE_SEQUENCE.length];
  const phases = profilePhases(profileId, seed, random);
  const faultPatch = {
    ...phases.at(-1).patch,
    scenario: ELECTRICAL_SCENARIOS.INTERNAL_FAULT,
    remoteMagnitudePct: range(random, 88, 112),
    remotePhaseDeg: range(random, -3, 3),
    harmonic3Pct: range(random, 0, 4),
    dcOffsetPct: range(random, 0, 16),
    halfWaveAsymmetryPct: range(random, 0, 5),
    corruptionPct: 0,
    packetLossPct: Math.min(1.2, Number(phases.at(-1).patch.packetLossPct ?? 0)),
    burstLossPct: Math.min(1.5, Number(phases.at(-1).patch.burstLossPct ?? 0)),
    maxConsecutiveLossFrames: Math.max(4, Number(phases.at(-1).patch.maxConsecutiveLossFrames ?? 4)),
    packetAbsoluteAgeMs: Math.max(40, Number(phases.at(-1).patch.packetAbsoluteAgeMs ?? 40))
  };

  return {
    id: `DEP-${String(index + 1).padStart(4, '0')}`,
    index,
    seed,
    profileId,
    preparationPhases: phases,
    faultPatch
  };
}

function runPhase(simulator, phaseDefinition, stepMs) {
  simulator.setConfig(phaseDefinition.patch);
  let frame = null;
  const steps = Math.max(1, Math.ceil(phaseDefinition.durationMs / stepMs));
  for (let index = 0; index < steps; index += 1) frame = simulator.step(stepMs);
  return frame;
}

export function runDependabilityCase(testCase, options = {}) {
  const stepMs = Math.max(5, Number(options.stepMs ?? DEFAULT_DEPENDABILITY_OPTIONS.stepMs));
  const faultMs = Math.max(100, Number(options.faultMs ?? DEFAULT_DEPENDABILITY_OPTIONS.faultMs));
  const simulator = new Simulator({
    ...createDefaultConfig(),
    ...testCase.preparationPhases[0].patch,
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    seed: testCase.seed
  });

  let preFaultFrame = null;
  const preparationTrace = [];
  for (const phaseDefinition of testCase.preparationPhases) {
    preFaultFrame = runPhase(simulator, phaseDefinition, stepMs);
    preparationTrace.push({
      phase: phaseDefinition.name,
      state: preFaultFrame.protection.state,
      displayState: preFaultFrame.protection.displayState,
      permission: preFaultFrame.protection.permission,
      hardInvalid: preFaultFrame.confidence.hardInvalid,
      correctionAgeMs: preFaultFrame.confidence.correctionAgeMs,
      reasons: preFaultFrame.confidence.reasons
    });
  }

  simulator.setConfig(testCase.faultPatch);
  const faultSteps = Math.max(1, Math.ceil(faultMs / stepMs));
  let firstOperateMs = null;
  let eligibleFrames = 0;
  let consecutiveEligible = 0;
  let maximumConsecutiveEligible = 0;
  let tripAllowedFrames = 0;
  let degradedFrames = 0;
  let secureFrames = 0;
  let blockedFrames = 0;
  let hardInvalidFrames = 0;
  let strongEvidenceFrames = 0;
  let invariantViolationFrames = 0;
  let maximumCorrectionAgeMs = 0;
  let lastFrame = null;
  const reasonCounts = {};

  for (let index = 0; index < faultSteps; index += 1) {
    const frame = simulator.step(stepMs);
    lastFrame = frame;
    const elapsedMs = (index + 1) * stepMs;
    const eligible = frame.differential.measuredEvidenceValid && !frame.confidence.hardInvalid;
    if (eligible) {
      eligibleFrames += 1;
      consecutiveEligible += 1;
      maximumConsecutiveEligible = Math.max(maximumConsecutiveEligible, consecutiveEligible);
    } else {
      consecutiveEligible = 0;
    }
    if (frame.protection.tripAllowed) tripAllowedFrames += 1;
    if (frame.protection.degraded) degradedFrames += 1;
    if (frame.protection.state === PROTECTION_STATES.SECURE) secureFrames += 1;
    if (
      frame.protection.state === PROTECTION_STATES.BLOCKED ||
      frame.protection.state === PROTECTION_STATES.RECOVERY
    ) blockedFrames += 1;
    if (frame.confidence.hardInvalid) hardInvalidFrames += 1;
    if (frame.differential.strongInternalEvidence) strongEvidenceFrames += 1;
    if ((frame.protection.safetyInvariantViolations ?? []).length > 0) invariantViolationFrames += 1;
    maximumCorrectionAgeMs = Math.max(maximumCorrectionAgeMs, Number(frame.confidence.correctionAgeMs ?? 0));
    if (frame.protection.operate && firstOperateMs === null) firstOperateMs = elapsedMs;
    for (const reason of frame.confidence.reasons) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }
  }

  const eligibilityRatio = eligibleFrames / faultSteps;
  const dependabilityEligible = eligibilityRatio >= 0.5 && maximumConsecutiveEligible >= 3;

  return {
    caseId: testCase.id,
    seed: testCase.seed,
    profileId: testCase.profileId,
    preFaultState: preFaultFrame.protection.state,
    preFaultDisplayState: preFaultFrame.protection.displayState,
    preFaultPermission: preFaultFrame.protection.permission,
    preFaultCorrectionAgeMs: round(preFaultFrame.confidence.correctionAgeMs, 2),
    preparationTrace,
    faultFrames: faultSteps,
    eligibleFrames,
    eligibilityPct: round(eligibilityRatio * 100, 4),
    maximumConsecutiveEligible,
    dependabilityEligible,
    operated: firstOperateMs !== null,
    firstOperateMs,
    missedEligibleTrip: dependabilityEligible && firstOperateMs === null,
    communicationInhibited: !dependabilityEligible,
    availabilityPct: round((faultSteps - blockedFrames) / faultSteps * 100, 4),
    tripAllowedPct: round(tripAllowedFrames / faultSteps * 100, 4),
    degradedPct: round(degradedFrames / faultSteps * 100, 4),
    securePct: round(secureFrames / faultSteps * 100, 4),
    blockedPct: round(blockedFrames / faultSteps * 100, 4),
    hardInvalidPct: round(hardInvalidFrames / faultSteps * 100, 4),
    strongEvidenceFrames,
    invariantViolationFrames,
    maximumCorrectionAgeMs: round(maximumCorrectionAgeMs, 2),
    reasonCounts: Object.fromEntries(Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])),
    finalEvidence: lastFrame ? {
      state: lastFrame.protection.state,
      permission: lastFrame.protection.permission,
      decision: lastFrame.protection.decision,
      idiffPu: lastFrame.differential.validatedRmsPu,
      thresholdPu: lastFrame.differential.activeThresholdPu,
      coverage: lastFrame.differential.protectionValidFraction,
      correctionAgeMs: lastFrame.confidence.correctionAgeMs,
      reasons: lastFrame.confidence.reasons
    } : null
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
  return {
    count: finite.length,
    mean: round(finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null, 4),
    p50: round(percentile(finite, 0.5), 4),
    p95: round(percentile(finite, 0.95), 4),
    max: round(finite.length ? Math.max(...finite) : null, 4)
  };
}

function summarize(replays) {
  const eligible = replays.filter((replay) => replay.dependabilityEligible);
  const operatedEligible = eligible.filter((replay) => replay.operated);
  const byProfile = {};
  for (const profileId of PROFILE_SEQUENCE) {
    const selected = replays.filter((replay) => replay.profileId === profileId);
    const profileEligible = selected.filter((replay) => replay.dependabilityEligible);
    byProfile[profileId] = {
      cases: selected.length,
      eligibleCases: profileEligible.length,
      eligibleTrips: profileEligible.filter((replay) => replay.operated).length,
      missedEligibleTrips: profileEligible.filter((replay) => replay.missedEligibleTrip).length,
      communicationInhibited: selected.filter((replay) => replay.communicationInhibited).length,
      preFaultStates: selected.reduce((counts, replay) => {
        counts[replay.preFaultDisplayState] = (counts[replay.preFaultDisplayState] ?? 0) + 1;
        return counts;
      }, {}),
      operatingTimeMs: distribution(profileEligible.map((replay) => replay.firstOperateMs)),
      availabilityPct: distribution(selected.map((replay) => replay.availabilityPct))
    };
  }

  return {
    totalCases: replays.length,
    eligibleCases: eligible.length,
    eligibleTrips: operatedEligible.length,
    missedEligibleTrips: eligible.filter((replay) => replay.missedEligibleTrip).length,
    communicationInhibited: replays.filter((replay) => replay.communicationInhibited).length,
    invariantViolationFrames: replays.reduce((sum, replay) => sum + replay.invariantViolationFrames, 0),
    operatingTimeMs: distribution(operatedEligible.map((replay) => replay.firstOperateMs)),
    availabilityPct: distribution(replays.map((replay) => replay.availabilityPct)),
    byProfile
  };
}

export function runDegradedDependabilityCampaign(options = {}) {
  const merged = { ...DEFAULT_DEPENDABILITY_OPTIONS, ...options };
  const count = Math.max(1, Math.floor(Number(merged.cases)));
  const cases = Array.from({ length: count }, (_, index) => generateDependabilityCase(index, merged));
  const replays = cases.map((testCase) => runDependabilityCase(testCase, merged));
  const summary = summarize(replays);

  return {
    format: 'line-differential-relay-lab-degraded-dependability',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    options: {
      seed: Number(merged.seed),
      cases: count,
      stepMs: Number(merged.stepMs),
      faultMs: Number(merged.faultMs)
    },
    interpretation: {
      eligibleDefinition: 'Measured-valid non-hard-invalid evidence for at least 50% of fault frames and three consecutive frames.',
      limitation: 'Synthetic single-phase regression evidence; not relay certification or field dependability proof.'
    },
    summary,
    cases: merged.includeCaseDetails ? cases : undefined,
    replays: merged.includeCaseDetails ? replays : undefined
  };
}

export function dependabilityReportMarkdown(report) {
  const lines = [
    '# P7 Degraded Internal-Fault Dependability',
    '',
    `- Cases: ${report.summary.totalCases}`,
    `- Eligible: ${report.summary.eligibleCases}`,
    `- Eligible trips: ${report.summary.eligibleTrips}`,
    `- Missed eligible trips: ${report.summary.missedEligibleTrips}`,
    `- Communication-inhibited: ${report.summary.communicationInhibited}`,
    `- Safety-invariant violation frames: ${report.summary.invariantViolationFrames}`,
    `- Operating time P50/P95: ${report.summary.operatingTimeMs.p50 ?? 'n/a'} / ${report.summary.operatingTimeMs.p95 ?? 'n/a'} ms`,
    '',
    '| Pre-fault profile | Cases | Eligible | Trips | Misses | Inhibited | Operating P95 | Availability mean |',
    '|---|---:|---:|---:|---:|---:|---:|---:|'
  ];
  for (const [profileId, item] of Object.entries(report.summary.byProfile)) {
    lines.push(`| ${profileId} | ${item.cases} | ${item.eligibleCases} | ${item.eligibleTrips} | ${item.missedEligibleTrips} | ${item.communicationInhibited} | ${item.operatingTimeMs.p95 ?? 'n/a'} ms | ${item.availabilityPct.mean ?? 'n/a'}% |`);
  }
  lines.push(
    '',
    '> This finite synthetic campaign is regression evidence only. It is not a certified relay test or field-reliability claim.',
    ''
  );
  return lines.join('\n');
}
