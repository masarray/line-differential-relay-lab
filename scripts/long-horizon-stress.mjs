import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DEFAULT_STRESS_OPTIONS,
  DEFAULT_STRESS_PROFILES,
  STRESS_PROFILE_IDS,
  formatLongHorizonStressMarkdown,
  runLongHorizonStressCampaign
} from '../src/validation/long-horizon-stress.js';

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

function parseProfileIds(value) {
  const supported = new Set(DEFAULT_STRESS_PROFILES.map((profile) => profile.id));
  const profileIds = value
    ? value.split(',').map((entry) => entry.trim()).filter((entry) => supported.has(entry))
    : DEFAULT_STRESS_OPTIONS.profiles;
  if (profileIds.length === 0) throw new Error('No supported long-horizon stress profiles selected.');
  return profileIds;
}

function resolveExtremeProfiles(profileIds) {
  return profileIds.map((profileId) => {
    const base = DEFAULT_STRESS_PROFILES.find((profile) => profile.id === profileId);
    if (!base) throw new Error(`Unsupported stress profile: ${profileId}`);
    if (profileId !== STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED) return base;

    // P5 intentionally uses a demanding but still bounded generic supervision
    // profile. These are research settings, not a representation of any vendor.
    return {
      ...base,
      settings: {
        ...base.settings,
        secureWindowMs: 120,
        recoveryValidationMs: 160,
        securePickupMultiplier: 1.25
      }
    };
  });
}

const smoke = hasFlag('smoke');
const seeds = positiveInteger(readArgument('seeds'), smoke ? 2 : DEFAULT_STRESS_OPTIONS.seeds);
const episodes = positiveInteger(readArgument('episodes'), smoke ? 30 : DEFAULT_STRESS_OPTIONS.episodes);
const seed = positiveInteger(readArgument('seed'), DEFAULT_STRESS_OPTIONS.seed);
const stepMs = positiveInteger(readArgument('step-ms'), DEFAULT_STRESS_OPTIONS.stepMs);
const profileIds = parseProfileIds(readArgument('profiles'));
const profiles = resolveExtremeProfiles(profileIds);
const includeReplayDetails = !hasFlag('compact');
const stopAfterFirstTrip = hasFlag('stop-after-first-trip');
const outputDirectory = resolve(process.cwd(), readArgument('output', 'artifacts/long-horizon-stress'));

const report = runLongHorizonStressCampaign({
  seeds,
  episodes,
  seed,
  stepMs,
  profiles,
  includeReplayDetails,
  stopAfterFirstTrip
});
const markdown = formatLongHorizonStressMarkdown(report);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'long-horizon-stress-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(outputDirectory, 'long-horizon-stress-report.md'), markdown)
]);

const failureDirectory = resolve(outputDirectory, 'failures');
if (report.failures.length > 0) {
  await mkdir(failureDirectory, { recursive: true });
  const failureWrites = report.failures.slice(0, 50).map((failure, index) => {
    const safeProfile = failure.profileId.replace(/[^a-z0-9-]+/gi, '-');
    const fileName = `${String(index + 1).padStart(3, '0')}-${safeProfile}-seed-${failure.seed}.json`;
    return writeFile(resolve(failureDirectory, fileName), `${JSON.stringify(failure, null, 2)}\n`);
  });
  await Promise.all(failureWrites);
}

console.log([
  'Accelerated long-horizon stress campaign complete:',
  `${report.campaign.seeds} seeds`,
  `${report.campaign.episodesPerSeed} episodes/seed`,
  `${report.campaign.replayCount} policy replays`
].join(' '));
for (const profileId of report.campaign.profiles) {
  const result = report.summary[profileId];
  console.log([
    profileId.padEnd(31),
    `failed=${result.failedRuns}/${result.runs}`,
    `ops/1000ep=${result.unwantedOperationsPer1000Episodes}`,
    `first-trip-p50=${result.episodesToFirstTrip.p50 ?? 'n/a'}ep`,
    `reopens=${result.permissionReopenCount.mean ?? 'n/a'}`
  ].join('  '));
}
console.log(`Reports: ${outputDirectory}`);

if (hasFlag('require-baseline-failures')) {
  const requiredProfiles = [
    STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED,
    STRESS_PROFILE_IDS.FIXED_OBSERVATION_WINDOW
  ].filter((profileId) => profileIds.includes(profileId));
  const missing = requiredProfiles.filter((profileId) => report.summary[profileId]?.failedRuns < 1);
  if (missing.length > 0) {
    throw new Error(`Stress budget found no unwanted-trip counterexample for: ${missing.join(', ')}`);
  }
}
