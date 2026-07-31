import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DEFAULT_DEPENDABILITY_OPTIONS,
  dependabilityReportMarkdown,
  runDegradedDependabilityCampaign
} from '../src/validation/degraded-dependability.js';

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

const report = runDegradedDependabilityCampaign({
  cases,
  seed,
  stepMs,
  faultMs,
  includeCaseDetails
});
const markdown = dependabilityReportMarkdown(report);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'degraded-dependability-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(outputDirectory, 'degraded-dependability-report.md'), markdown)
]);

console.log([
  'P7 degraded internal-fault dependability complete:',
  `${report.summary.totalCases} cases`,
  `eligible=${report.summary.eligibleCases}`,
  `trips=${report.summary.eligibleTrips}`,
  `misses=${report.summary.missedEligibleTrips}`,
  `inhibited=${report.summary.communicationInhibited}`,
  `p95=${report.summary.operatingTimeMs.p95 ?? 'n/a'}ms`,
  `invariant-violations=${report.summary.invariantViolationFrames}`
].join('  '));
for (const [profileId, summary] of Object.entries(report.summary.byProfile)) {
  console.log([
    profileId.padEnd(22),
    `eligible=${summary.eligibleCases}/${summary.cases}`,
    `trips=${summary.eligibleTrips}`,
    `misses=${summary.missedEligibleTrips}`,
    `p95=${summary.operatingTimeMs.p95 ?? 'n/a'}ms`,
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
