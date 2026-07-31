import {
  DEPENDABILITY_PROFILE_IDS,
  runDegradedDependabilityCampaign
} from './degraded-dependability.js';
import { runQualifiedOperatingTiming } from './qualified-operating-timing.js';

const PROFILE_IDS = Object.freeze(Object.values(DEPENDABILITY_PROFILE_IDS));

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values, probability) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const position = (finite.length - 1) * Math.min(1, Math.max(0, probability));
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

function qualifyReplay(replay, timing) {
  const communicationEligible =
    replay.eligibilityPct >= 50 &&
    replay.maximumConsecutiveEligible >= 3;
  const alignmentEligible = timing.maximumConsecutiveTripAllowedFrames >= 3;
  const dependabilityEligible = communicationEligible && alignmentEligible;

  return {
    ...replay,
    ...timing,
    communicationEligible,
    alignmentEligible,
    dependabilityEligible,
    operatedEligible: dependabilityEligible && replay.operated,
    missedEligibleTrip: dependabilityEligible && !replay.operated,
    communicationInhibited: !communicationEligible,
    alignmentInhibited: communicationEligible && !alignmentEligible,
    inhibitionClass: !communicationEligible
      ? 'COMMUNICATION_INHIBITED'
      : !alignmentEligible
        ? 'ALIGNMENT_INHIBITED'
        : 'DEPENDABILITY_ELIGIBLE'
  };
}

function timingSummary(selected) {
  const eligible = selected.filter((replay) => replay.dependabilityEligible);
  const eligibleOperated = eligible.filter((replay) => replay.operated);
  const preFaultAvailableEligible = eligibleOperated.filter((replay) => replay.preFaultOperationallyAvailable);
  return {
    faultToTripMs: distribution(eligibleOperated.map((replay) => replay.faultToTripMs)),
    preFaultAvailableFaultToTripMs: distribution(
      preFaultAvailableEligible.map((replay) => replay.faultToTripMs)
    ),
    permissionDelayMs: distribution(eligibleOperated.map((replay) => replay.operatingPermissionStartMs)),
    qualifiedOperatingLatencyMs: distribution(
      eligibleOperated.map((replay) => replay.qualifiedOperatingLatencyMs)
    ),
    preFaultAvailableEligibleCases: preFaultAvailableEligible.length
  };
}

function summarize(replays) {
  const eligible = replays.filter((replay) => replay.dependabilityEligible);
  const byProfile = {};
  for (const profileId of PROFILE_IDS) {
    const selected = replays.filter((replay) => replay.profileId === profileId);
    const profileEligible = selected.filter((replay) => replay.dependabilityEligible);
    byProfile[profileId] = {
      cases: selected.length,
      eligibleCases: profileEligible.length,
      eligibleTrips: profileEligible.filter((replay) => replay.operated).length,
      missedEligibleTrips: profileEligible.filter((replay) => replay.missedEligibleTrip).length,
      communicationInhibited: selected.filter((replay) => replay.communicationInhibited).length,
      alignmentInhibited: selected.filter((replay) => replay.alignmentInhibited).length,
      preFaultStates: selected.reduce((counts, replay) => {
        counts[replay.preFaultDisplayState] = (counts[replay.preFaultDisplayState] ?? 0) + 1;
        return counts;
      }, {}),
      ...timingSummary(selected),
      availabilityPct: distribution(selected.map((replay) => replay.availabilityPct))
    };
  }

  return {
    totalCases: replays.length,
    eligibleCases: eligible.length,
    eligibleTrips: eligible.filter((replay) => replay.operated).length,
    missedEligibleTrips: eligible.filter((replay) => replay.missedEligibleTrip).length,
    communicationInhibited: replays.filter((replay) => replay.communicationInhibited).length,
    alignmentInhibited: replays.filter((replay) => replay.alignmentInhibited).length,
    invariantViolationFrames: replays.reduce((sum, replay) => sum + replay.invariantViolationFrames, 0),
    ...timingSummary(replays),
    // Backward-compatible alias. It intentionally remains full fault-to-trip
    // timing and must not be confused with qualified operating latency.
    operatingTimeMs: distribution(eligible.map((replay) => replay.faultToTripMs)),
    availabilityPct: distribution(replays.map((replay) => replay.availabilityPct)),
    byProfile
  };
}

export function runEvidenceQualifiedDependabilityCampaign(options = {}) {
  const raw = runDegradedDependabilityCampaign({ ...options, includeCaseDetails: true });
  const timingByCase = new Map(raw.cases.map((testCase) => [
    testCase.id,
    runQualifiedOperatingTiming(testCase, options)
  ]));
  const replays = raw.replays.map((replay) => qualifyReplay(replay, timingByCase.get(replay.caseId)));
  const summary = summarize(replays);
  return {
    ...raw,
    interpretation: {
      communicationEligible: 'Measured-valid, non-hard-invalid remote evidence for at least 50% of fault frames and at least three consecutive frames.',
      alignmentEligible: 'At least three consecutive fault frames with final trip permission available after all Smart evidence gates.',
      alignmentInhibited: 'Remote samples exist, but their time alignment is not trustworthy enough to make a differential trip expectation fair.',
      faultToTripMs: 'Total delay from fault application, including any initial revalidation or protection-unavailable interval.',
      qualifiedOperatingLatencyMs: 'Latency from the final continuous trip-permission streak that leads to operation; this represents protection persistence after evidence is qualified.',
      limitation: 'Synthetic single-phase regression evidence; not relay certification or field dependability proof.'
    },
    summary,
    replays,
    cases: options.includeCaseDetails === false ? undefined : raw.cases
  };
}

export function evidenceQualifiedDependabilityMarkdown(report) {
  const lines = [
    '# P7 Evidence-Qualified Internal-Fault Dependability',
    '',
    `- Cases: ${report.summary.totalCases}`,
    `- Dependability-eligible: ${report.summary.eligibleCases}`,
    `- Eligible trips: ${report.summary.eligibleTrips}`,
    `- Missed eligible trips: ${report.summary.missedEligibleTrips}`,
    `- Communication-inhibited: ${report.summary.communicationInhibited}`,
    `- Alignment-inhibited: ${report.summary.alignmentInhibited}`,
    `- Safety-invariant violation frames: ${report.summary.invariantViolationFrames}`,
    `- Full fault-to-trip P50/P95: ${report.summary.faultToTripMs.p50 ?? 'n/a'} / ${report.summary.faultToTripMs.p95 ?? 'n/a'} ms`,
    `- Pre-fault-available fault-to-trip P95: ${report.summary.preFaultAvailableFaultToTripMs.p95 ?? 'n/a'} ms`,
    `- Qualified operating latency P50/P95: ${report.summary.qualifiedOperatingLatencyMs.p50 ?? 'n/a'} / ${report.summary.qualifiedOperatingLatencyMs.p95 ?? 'n/a'} ms`,
    '',
    '| Pre-fault profile | Cases | Eligible | Trips | Misses | Comm inhibited | Alignment inhibited | Full P95 | Qualified P95 | Available-at-fault P95 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
  ];
  for (const [profileId, item] of Object.entries(report.summary.byProfile)) {
    lines.push(`| ${profileId} | ${item.cases} | ${item.eligibleCases} | ${item.eligibleTrips} | ${item.missedEligibleTrips} | ${item.communicationInhibited} | ${item.alignmentInhibited} | ${item.faultToTripMs.p95 ?? 'n/a'} ms | ${item.qualifiedOperatingLatencyMs.p95 ?? 'n/a'} ms | ${item.preFaultAvailableFaultToTripMs.p95 ?? 'n/a'} ms |`);
  }
  lines.push(
    '',
    'Full fault-to-trip time deliberately includes revalidation delay. Qualified operating latency begins only when the final trusted permission streak starts. Both are reported so slow availability is not hidden as fast relay operation.',
    '',
    'An alignment-inhibited internal fault is reported explicitly rather than hidden as communication failure or counted as a fair missed-trip expectation.',
    '',
    '> This finite synthetic campaign is regression evidence only. It is not a certified relay test or field-reliability claim.',
    ''
  );
  return lines.join('\n');
}
