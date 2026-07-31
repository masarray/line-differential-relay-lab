import { SECURITY_POLICIES } from '../engine/constants.js';
import {
  DEFAULT_STRESS_PROFILES,
  STRESS_PROFILE_IDS
} from './long-horizon-stress.js';
import { runRecoveryQualifiedStressCampaign } from './recovery-qualified-stress.js';
import { runEvidenceQualifiedDependabilityCampaign } from './evidence-qualified-dependability.js';

export const DEFAULT_RELIABILITY_FREEZE_OPTIONS = Object.freeze({
  seed: 87161850,
  stressSeeds: 8,
  stressEpisodes: 120,
  dependabilityCases: 64,
  stepMs: 20,
  faultMs: 360,
  includeDetails: false
});

function communicationOnlyProfiles() {
  return DEFAULT_STRESS_PROFILES.map((profile) => {
    if (profile.id !== STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED) return profile;
    return {
      ...profile,
      label: 'Communication-only supervised RTT/2',
      securityPolicy: SECURITY_POLICIES.COMMUNICATION_ONLY_SUPERVISED
    };
  });
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function evaluateReliabilityFreeze(report) {
  const stress = report.security.summary;
  const smart = stress[STRESS_PROFILE_IDS.SMART_WAVEFORM];
  const communication = stress[STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED];
  const fixed = stress[STRESS_PROFILE_IDS.FIXED_OBSERVATION_WINDOW];
  const dependability = report.dependability.summary;
  const failures = [];

  if (!smart) failures.push('SMART_STRESS_RESULT_MISSING');
  else {
    if (smart.failedRuns !== 0) failures.push('SMART_UNWANTED_OPERATION_FOUND');
    if ((smart.availabilityPct?.mean ?? 0) < 35) failures.push('SMART_AVAILABILITY_BELOW_35_PERCENT');
  }
  if (!communication || communication.failedRuns < 1) {
    failures.push('COMMUNICATION_SUPERVISED_COUNTEREXAMPLE_MISSING');
  }
  if (!fixed || fixed.failedRuns < 1) failures.push('FIXED_WINDOW_COUNTEREXAMPLE_MISSING');
  if (dependability.missedEligibleTrips !== 0) failures.push('ELIGIBLE_INTERNAL_FAULT_MISS_FOUND');
  if (dependability.eligibleCases < Math.floor(report.campaign.dependabilityCases * 0.5)) {
    failures.push('INSUFFICIENT_DEPENDABILITY_ELIGIBLE_CASES');
  }
  if (dependability.invariantViolationFrames !== 0) failures.push('SAFETY_INVARIANT_VIOLATION_FOUND');
  if ((dependability.operatingTimeMs?.p95 ?? Number.POSITIVE_INFINITY) > 160) {
    failures.push('DEPENDABILITY_P95_ABOVE_160_MS');
  }

  return {
    passed: failures.length === 0,
    failures,
    acceptance: {
      smartUnwantedOperations: smart?.totalOperations ?? null,
      smartFailedRuns: smart?.failedRuns ?? null,
      smartAvailabilityMeanPct: round(smart?.availabilityPct?.mean),
      baselineCommunicationFailedRuns: communication?.failedRuns ?? null,
      baselineFixedWindowFailedRuns: fixed?.failedRuns ?? null,
      dependabilityEligibleCases: dependability.eligibleCases,
      eligibleInternalTrips: dependability.eligibleTrips,
      missedEligibleTrips: dependability.missedEligibleTrips,
      communicationInhibited: dependability.communicationInhibited,
      alignmentInhibited: dependability.alignmentInhibited,
      dependabilityP95Ms: dependability.operatingTimeMs?.p95 ?? null,
      invariantViolationFrames: dependability.invariantViolationFrames
    }
  };
}

export function runReliabilityFreezeCampaign(options = {}) {
  const merged = { ...DEFAULT_RELIABILITY_FREEZE_OPTIONS, ...options };
  const profiles = communicationOnlyProfiles();
  const security = runRecoveryQualifiedStressCampaign({
    seed: Number(merged.seed),
    seeds: Number(merged.stressSeeds),
    episodes: Number(merged.stressEpisodes),
    stepMs: Number(merged.stepMs),
    profiles,
    includeReplayDetails: Boolean(merged.includeDetails),
    stopAfterFirstTrip: false
  });
  const dependability = runEvidenceQualifiedDependabilityCampaign({
    seed: Number(merged.seed),
    cases: Number(merged.dependabilityCases),
    stepMs: Number(merged.stepMs),
    faultMs: Number(merged.faultMs),
    includeCaseDetails: Boolean(merged.includeDetails)
  });
  const report = {
    format: 'line-differential-relay-lab-p7-reliability-freeze',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    campaign: {
      masterSeed: Number(merged.seed),
      stressSeeds: Number(merged.stressSeeds),
      stressEpisodesPerSeed: Number(merged.stressEpisodes),
      stressEpisodeExposuresPerProfile: Number(merged.stressSeeds) * Number(merged.stressEpisodes),
      dependabilityCases: Number(merged.dependabilityCases),
      stepMs: Number(merged.stepMs),
      faultMs: Number(merged.faultMs),
      scope: 'Synthetic, receiver-observable, deterministic publication regression gate.',
      limitation: 'Not field reliability proof, relay certification, or manufacturer-algorithm equivalence.'
    },
    security,
    dependability
  };
  report.gate = evaluateReliabilityFreeze(report);
  return report;
}

export function reliabilityFreezeMarkdown(report) {
  const gate = report.gate;
  const smart = report.security.summary[STRESS_PROFILE_IDS.SMART_WAVEFORM];
  const lines = [
    '# P7 Engine Reliability Freeze',
    '',
    `**Gate: ${gate.passed ? 'PASS' : 'FAIL'}**`,
    '',
    '## Campaign',
    '',
    `- Security stress: ${report.campaign.stressSeeds} seeds × ${report.campaign.stressEpisodesPerSeed} episodes = ${report.campaign.stressEpisodeExposuresPerProfile} episode exposures per profile`,
    `- Evidence-qualified internal faults: ${report.campaign.dependabilityCases} cases`,
    `- Master seed: ${report.campaign.masterSeed}`,
    '',
    '## Acceptance summary',
    '',
    `- Smart failed stress runs: ${gate.acceptance.smartFailedRuns}`,
    `- Smart unwanted operations: ${gate.acceptance.smartUnwantedOperations}`,
    `- Smart mean availability: ${gate.acceptance.smartAvailabilityMeanPct}%`,
    `- Communication-supervised baseline failed runs: ${gate.acceptance.baselineCommunicationFailedRuns}`,
    `- Fixed-window baseline failed runs: ${gate.acceptance.baselineFixedWindowFailedRuns}`,
    `- Dependability-eligible internal cases: ${gate.acceptance.dependabilityEligibleCases}`,
    `- Eligible internal trips: ${gate.acceptance.eligibleInternalTrips}`,
    `- Missed eligible trips: ${gate.acceptance.missedEligibleTrips}`,
    `- Communication-inhibited internal cases: ${gate.acceptance.communicationInhibited}`,
    `- Alignment-inhibited internal cases: ${gate.acceptance.alignmentInhibited}`,
    `- Internal-fault operating time P95: ${gate.acceptance.dependabilityP95Ms} ms`,
    `- Safety-invariant violation frames: ${gate.acceptance.invariantViolationFrames}`,
    '',
    '## Security profiles',
    '',
    '| Profile | Failed runs | Operations / 1,000 episodes | Mean availability |',
    '|---|---:|---:|---:|'
  ];
  for (const [profileId, item] of Object.entries(report.security.summary)) {
    lines.push(`| ${item.label ?? profileId} | ${item.failedRuns}/${item.runs} | ${item.unwantedOperationsPer1000Episodes} | ${item.availabilityPct.mean}% |`);
  }
  lines.push(
    '',
    '## Interpretation',
    '',
    `The Smart profile completed this finite campaign with ${smart.failedRuns} failed runs and ${smart.availabilityPct.mean}% mean availability. Internal-fault expectations were applied only when both communication evidence and alignment evidence were qualified. Cases with measured samples but untrusted timing were reported separately as alignment-inhibited.`,
    '',
    ...(gate.failures.length ? ['## Gate failures', '', ...gate.failures.map((failure) => `- ${failure}`), ''] : []),
    '> This is a deterministic synthetic regression gate for a public engineering portfolio. It is not protection-relay certification or field reliability proof.',
    ''
  );
  return lines.join('\n');
}
