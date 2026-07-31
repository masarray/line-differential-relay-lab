import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ALGORITHM_MODES } from '../src/engine/constants.js';
import {
  DEFAULT_CAMPAIGN_OPTIONS,
  DEFAULT_VALIDATION_ALGORITHMS,
  formatMonteCarloMarkdown,
  runMonteCarloCampaign
} from '../src/validation/monte-carlo.js';

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

function parseAlgorithms(value, includeGps) {
  const supported = new Set(Object.values(ALGORITHM_MODES));
  const selected = value
    ? value.split(',').map((entry) => entry.trim()).filter((entry) => supported.has(entry))
    : [...DEFAULT_VALIDATION_ALGORITHMS];
  if (includeGps && !selected.includes(ALGORITHM_MODES.GPS)) selected.push(ALGORITHM_MODES.GPS);
  if (selected.length === 0) throw new Error('No supported algorithms selected.');
  return selected;
}

const smoke = hasFlag('smoke');
const cases = positiveInteger(readArgument('cases'), smoke ? 12 : DEFAULT_CAMPAIGN_OPTIONS.cases);
const seed = positiveInteger(readArgument('seed'), DEFAULT_CAMPAIGN_OPTIONS.seed);
const stepMs = positiveInteger(readArgument('step-ms'), DEFAULT_CAMPAIGN_OPTIONS.stepMs);
const outputDirectory = resolve(process.cwd(), readArgument('output', 'artifacts/validation'));
const algorithms = parseAlgorithms(readArgument('algorithms'), hasFlag('include-gps'));
const includeCaseDetails = !hasFlag('compact');

const report = runMonteCarloCampaign({
  cases,
  seed,
  stepMs,
  algorithms,
  includeCaseDetails
});
const markdown = formatMonteCarloMarkdown(report);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'monte-carlo-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(outputDirectory, 'monte-carlo-report.md'), markdown)
]);

console.log(`Blind Monte Carlo campaign complete: ${report.campaign.cases} cases / ${report.campaign.replayCount} replays`);
for (const algorithm of report.campaign.algorithms) {
  const result = report.summary[algorithm];
  console.log([
    algorithm.padEnd(16),
    `unwanted=${result.unwantedTrips}/${result.securityCases}`,
    `dependability=${result.eligibleInternalTrips}/${result.dependabilityEligibleCases}`,
    `trip-p95=${result.tripOperatingTimeMs.p95 ?? 'n/a'}ms`,
    `align-rmse=${result.alignmentRmseMs.mean ?? 'n/a'}ms`
  ].join('  '));
}
console.log(`Reports: ${outputDirectory}`);
