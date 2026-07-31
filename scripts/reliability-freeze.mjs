import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DEFAULT_RELIABILITY_FREEZE_OPTIONS,
  reliabilityFreezeMarkdown,
  runReliabilityFreezeCampaign
} from '../src/validation/reliability-freeze.js';

function readArgument(name, fallback = null) {
  const direct = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const stressSeeds = positiveInteger(readArgument('stress-seeds'), DEFAULT_RELIABILITY_FREEZE_OPTIONS.stressSeeds);
const stressEpisodes = positiveInteger(readArgument('stress-episodes'), DEFAULT_RELIABILITY_FREEZE_OPTIONS.stressEpisodes);
const dependabilityCases = positiveInteger(readArgument('dependability-cases'), DEFAULT_RELIABILITY_FREEZE_OPTIONS.dependabilityCases);
const seed = positiveInteger(readArgument('seed'), DEFAULT_RELIABILITY_FREEZE_OPTIONS.seed);
const stepMs = positiveInteger(readArgument('step-ms'), DEFAULT_RELIABILITY_FREEZE_OPTIONS.stepMs);
const faultMs = positiveInteger(readArgument('fault-ms'), DEFAULT_RELIABILITY_FREEZE_OPTIONS.faultMs);
const outputDirectory = resolve(process.cwd(), readArgument('output', 'artifacts/reliability-freeze'));

const report = runReliabilityFreezeCampaign({
  seed,
  stressSeeds,
  stressEpisodes,
  dependabilityCases,
  stepMs,
  faultMs,
  includeDetails: false
});
const markdown = reliabilityFreezeMarkdown(report);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'reliability-freeze-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(outputDirectory, 'reliability-freeze-report.md'), markdown)
]);

console.log([
  `P7 reliability freeze ${report.gate.passed ? 'PASS' : 'FAIL'}:`,
  `security=${stressSeeds}x${stressEpisodes} episodes/profile`,
  `dependability=${dependabilityCases} cases`,
  `smart-failures=${report.gate.acceptance.smartFailedRuns}`,
  `smart-availability=${report.gate.acceptance.smartAvailabilityMeanPct}%`,
  `eligible-trips=${report.gate.acceptance.eligibleInternalTrips}/${report.gate.acceptance.dependabilityEligibleCases}`,
  `alignment-inhibited=${report.gate.acceptance.alignmentInhibited}`,
  `full-fault-p95=${report.gate.acceptance.fullFaultToTripP95Ms}ms`,
  `qualified-p95=${report.gate.acceptance.qualifiedOperatingLatencyP95Ms}ms`,
  `available-at-fault-p95=${report.gate.acceptance.preFaultAvailableFaultToTripP95Ms}ms`,
  `invariant-violations=${report.gate.acceptance.invariantViolationFrames}`
].join('  '));

for (const [profileId, summary] of Object.entries(report.dependability.summary.byProfile)) {
  console.log([
    `dependability/${profileId}`.padEnd(40),
    `eligible=${summary.eligibleTrips}/${summary.eligibleCases}`,
    `misses=${summary.missedEligibleTrips}`,
    `comm-inhibited=${summary.communicationInhibited}`,
    `align-inhibited=${summary.alignmentInhibited}`,
    `full-p95=${summary.faultToTripMs.p95 ?? 'n/a'}ms`,
    `qualified-p95=${summary.qualifiedOperatingLatencyMs.p95 ?? 'n/a'}ms`,
    `available-at-fault-p95=${summary.preFaultAvailableFaultToTripMs.p95 ?? 'n/a'}ms`
  ].join('  '));
}

const slowestEligible = report.dependability.replays
  .filter((replay) => replay.dependabilityEligible && Number.isFinite(replay.faultToTripMs))
  .sort((left, right) => right.faultToTripMs - left.faultToTripMs)
  .slice(0, 10);
if (slowestEligible.length > 0) {
  console.log('Slowest full fault-to-trip cases, including revalidation:');
  for (const replay of slowestEligible) {
    console.log([
      replay.caseId,
      `profile=${replay.profileId}`,
      `fault-to-trip=${replay.faultToTripMs}ms`,
      `permission-start=${replay.operatingPermissionStartMs ?? 'n/a'}ms`,
      `qualified-latency=${replay.qualifiedOperatingLatencyMs ?? 'n/a'}ms`,
      `pre-available=${replay.preFaultOperationallyAvailable}`,
      `pre-state=${replay.preFaultDisplayState}`,
      `pre-permission=${replay.preFaultPermission}`,
      `degraded=${replay.degradedPct}%`,
      `secure=${replay.securePct}%`,
      `blocked=${replay.blockedPct}%`,
      `strong-frames=${replay.strongEvidenceFrames}`,
      `max-correction-age=${replay.maximumCorrectionAgeMs}ms`,
      `final-reasons=${replay.finalEvidence?.reasons?.join('|') ?? 'none'}`
    ].join('  '));
  }
}
console.log(`Report: ${outputDirectory}`);

if (!report.gate.passed) {
  throw new Error(`P7 reliability freeze failed: ${report.gate.failures.join(', ')}`);
}
