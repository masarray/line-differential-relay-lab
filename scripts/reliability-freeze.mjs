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
  `p95=${report.gate.acceptance.dependabilityP95Ms}ms`,
  `invariant-violations=${report.gate.acceptance.invariantViolationFrames}`
].join('  '));
console.log(`Report: ${outputDirectory}`);

if (!report.gate.passed) {
  throw new Error(`P7 reliability freeze failed: ${report.gate.failures.join(', ')}`);
}
