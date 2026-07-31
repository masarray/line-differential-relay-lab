import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_DEPENDABILITY_OPTIONS } from '../src/validation/degraded-dependability.js';
import {
  evidenceQualifiedDependabilityMarkdown,
  runEvidenceQualifiedDependabilityCampaign
} from '../src/validation/evidence-qualified-dependability.js';

function readArgument(name, fallback = null) {
  const direct = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const smoke = hasFlag('smoke');
const cases = positiveInteger(readArgument('cases'), smoke ? 12 : DEFAULT_DEPENDABILITY_OPTIONS.cases);
const seed = positiveInteger(readArgument('seed'), DEFAULT_DEPENDABILITY_OPTIONS.seed);
const stepMs = positiveInteger(readArgument('step-ms'), DEFAULT_DEPENDABILITY_OPTIONS.stepMs);
const faultMs = positiveInteger(readArgument('fault-ms'), DEFAULT_DEPENDABILITY_OPTIONS.faultMs);
const includeCaseDetails = !hasFlag('compact');
const outputDirectory = resolve(process.cwd(), readArgument('output', 'artifacts/degraded-dependability'));

const report = runEvidenceQualifiedDependabilityCampaign({
  cases,
  seed,
  stepMs,
  faultMs,
  includeCaseDetails
});
const markdown = evidenceQualifiedDependabilityMarkdown(report);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'degraded-dependability-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(outputDirectory, 'degraded-dependability-report.md'), markdown)
]);

console.log([
  'P7 evidence-qualified internal-fault dependability complete:',
  `${report.summary.totalCases} cases`,
  `eligible=${report.summary.eligibleCases}`,
  `trips=${report.summary.eligibleTrips}`,
  `misses=${report.summary.missedEligibleTrips}`,
  `communication-inhibited=${report.summary.communicationInhibited}`,
  `alignment-inhibited=${report.summary.alignmentInhibited}`,
  `full-p95=${report.summary.faultToTripMs.p95 ?? 'n/a'}ms`,
  `qualified-p95=${report.summary.qualifiedOperatingLatencyMs.p95 ?? 'n/a'}ms`,
  `available-at-fault-p95=${report.summary.preFaultAvailableFaultToTripMs.p95 ?? 'n/a'}ms`,
  `invariant-violations=${report.summary.invariantViolationFrames}`
].join('  '));
for (const [profileId, summary] of Object.entries(report.summary.byProfile)) {
  console.log([
    profileId.padEnd(22),
    `eligible=${summary.eligibleCases}/${summary.cases}`,
    `trips=${summary.eligibleTrips}`,
    `misses=${summary.missedEligibleTrips}`,
    `comm-inhibited=${summary.communicationInhibited}`,
    `align-inhibited=${summary.alignmentInhibited}`,
    `full-p95=${summary.faultToTripMs.p95 ?? 'n/a'}ms`,
    `qualified-p95=${summary.qualifiedOperatingLatencyMs.p95 ?? 'n/a'}ms`,
    `availability=${summary.availabilityPct.mean ?? 'n/a'}%`
  ].join('  '));
}
console.log(`Reports: ${outputDirectory}`);

if (hasFlag('require-no-eligible-misses') && report.summary.missedEligibleTrips > 0) {
  throw new Error(`Dependability campaign found ${report.summary.missedEligibleTrips} missed eligible internal fault(s).`);
}
if (hasFlag('require-eligible-cases') && report.summary.eligibleCases < Math.max(1, Math.floor(cases * 0.5))) {
  throw new Error(`Only ${report.summary.eligibleCases}/${cases} internal faults were dependability-eligible.`);
}
if (report.summary.invariantViolationFrames > 0) {
  throw new Error(`Dependability campaign found ${report.summary.invariantViolationFrames} safety-invariant violation frame(s).`);
}
