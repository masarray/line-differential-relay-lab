import {
  DEFAULT_STRESS_OPTIONS,
  DEFAULT_STRESS_PROFILES,
  generateStressSchedule,
  runLongHorizonReplay,
  summarizeStressReplays
} from './long-horizon-stress.js';
import { hash32 } from '../engine/random.js';

const RECOVERY_QUALIFIED_PHASE_ORDER = Object.freeze([
  'link-flap',
  'partial-recovery',
  'deceptive-recovery',
  'jitter-storm',
  'pre-release-recovery',
  'asymmetric-route-flip',
  'high-through-current-release',
  'post-event-settle'
]);

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function runSeed(masterSeed, index) {
  return (hash32(masterSeed + Math.imul(index + 1, 0x5bd1e995)) % 2_147_483_646) + 1;
}

function profileFrom(profileOrId) {
  if (typeof profileOrId !== 'string') return profileOrId;
  const profile = DEFAULT_STRESS_PROFILES.find((candidate) => candidate.id === profileOrId);
  if (!profile) throw new Error(`Unsupported stress profile: ${profileOrId}`);
  return profile;
}

function phaseByName(episode, name) {
  const phase = episode.phases.find((candidate) => candidate.name === name);
  if (!phase) throw new Error(`Stress episode ${episode.id} is missing phase: ${name}`);
  return phase;
}

function makeCleanRecoveryPhase(source, sign) {
  const recovery = structuredClone(source);
  recovery.name = 'pre-release-recovery';
  recovery.durationMs = 460;
  recovery.recoveryOpportunity = true;
  recovery.preRelease = true;
  recovery.patch.asymmetryMs = sign * 0.06;
  recovery.patch.jitterMs = 0.035;
  recovery.patch.packetLossPct = 0;
  recovery.patch.burstLossPct = 0;
  recovery.patch.duplicatePct = 0;
  recovery.patch.reorderPct = 0;
  recovery.patch.corruptionPct = 0;
  recovery.patch.maxConsecutiveLossFrames = 8;
  recovery.patch.maxReceiverQueueFrames = 12;
  recovery.patch.packetAbsoluteAgeMs = 80;
  return recovery;
}

/**
 * Convert the base P5 schedule into a recovery-qualified rare-event sequence.
 * The relay must first receive enough healthy evidence to reopen. Only then is a
 * rapid one-way asymmetry change applied while packet validity remains good.
 * No protection output is forced and no algorithm receives evaluator truth.
 */
export function qualifyStressScheduleForRecovery(baseSchedule) {
  const schedule = structuredClone(baseSchedule);

  for (const episode of schedule.schedule) {
    const deceptiveRecovery = phaseByName(episode, 'deceptive-recovery');
    const routeFlip = phaseByName(episode, 'asymmetric-route-flip');
    const jitterStorm = phaseByName(episode, 'jitter-storm');
    const highCurrent = phaseByName(episode, 'high-through-current-release');
    const settle = phaseByName(episode, 'post-event-settle');
    const sign = Math.sign(episode.stressAsymmetryMs || 1) || 1;
    const moderateAsymmetryMs = sign * Math.min(2.6, Math.max(1.4, Math.abs(episode.stressAsymmetryMs) * 0.28));
    const releaseAsymmetryMs = episode.criticalOpportunity
      ? sign * Math.max(11.2, Math.abs(episode.stressAsymmetryMs))
      : sign * Math.min(4.2, Math.max(2.2, Math.abs(episode.stressAsymmetryMs)));

    deceptiveRecovery.durationMs = Math.max(520, deceptiveRecovery.durationMs);
    deceptiveRecovery.patch.asymmetryMs = sign * 0.08;
    deceptiveRecovery.patch.jitterMs = 0.04;
    deceptiveRecovery.patch.packetLossPct = 0;
    deceptiveRecovery.patch.burstLossPct = 0;
    deceptiveRecovery.patch.duplicatePct = 0;
    deceptiveRecovery.patch.reorderPct = 0;
    deceptiveRecovery.patch.corruptionPct = 0;
    deceptiveRecovery.patch.packetAbsoluteAgeMs = 80;

    // Severe jitter follows the first recovery but remains below hard-invalid
    // thresholds. A second healthy burst then gives each policy a fair chance to
    // reopen through its own state machine before the route asymmetry changes.
    jitterStorm.durationMs = Math.min(100, Math.max(60, jitterStorm.durationMs));
    jitterStorm.patch.asymmetryMs = moderateAsymmetryMs;
    jitterStorm.patch.jitterMs = Math.min(0.95, Math.max(0.55, jitterStorm.patch.jitterMs));
    jitterStorm.patch.packetLossPct = Math.min(0.25, jitterStorm.patch.packetLossPct ?? 0);
    jitterStorm.patch.burstLossPct = 0;
    jitterStorm.patch.duplicatePct = Math.min(2, jitterStorm.patch.duplicatePct ?? 0);
    jitterStorm.patch.reorderPct = Math.min(2, jitterStorm.patch.reorderPct ?? 0);
    jitterStorm.patch.reorderExtraDelayMs = Math.min(2, jitterStorm.patch.reorderExtraDelayMs ?? 2);
    jitterStorm.patch.maxConsecutiveLossFrames = 8;
    jitterStorm.patch.maxReceiverQueueFrames = 12;
    jitterStorm.patch.packetAbsoluteAgeMs = 80;

    episode.phases.push(makeCleanRecoveryPhase(deceptiveRecovery, sign));

    // The decisive one-way redistribution is placed immediately after the final
    // healthy burst and immediately before high current. RTT can remain plausible
    // although the forward/return split has changed sharply.
    routeFlip.durationMs = episode.criticalOpportunity ? 20 : 40;
    routeFlip.patch.asymmetryMs = releaseAsymmetryMs;
    routeFlip.patch.jitterMs = 0.05;
    routeFlip.patch.packetLossPct = 0;
    routeFlip.patch.burstLossPct = 0;
    routeFlip.patch.duplicatePct = 0;
    routeFlip.patch.reorderPct = 0;
    routeFlip.patch.corruptionPct = 0;
    routeFlip.patch.packetAbsoluteAgeMs = 80;

    highCurrent.durationMs = episode.criticalOpportunity
      ? Math.max(360, highCurrent.durationMs)
      : Math.max(160, highCurrent.durationMs);
    highCurrent.patch.asymmetryMs = releaseAsymmetryMs;
    highCurrent.patch.jitterMs = Math.min(0.09, highCurrent.patch.jitterMs);
    highCurrent.patch.packetLossPct = 0;
    highCurrent.patch.burstLossPct = 0;
    highCurrent.patch.duplicatePct = 0;
    highCurrent.patch.reorderPct = 0;
    highCurrent.patch.corruptionPct = 0;
    highCurrent.patch.packetAbsoluteAgeMs = 80;

    settle.durationMs = Math.max(180, settle.durationMs);
    episode.phases.sort((left, right) =>
      RECOVERY_QUALIFIED_PHASE_ORDER.indexOf(left.name) -
      RECOVERY_QUALIFIED_PHASE_ORDER.indexOf(right.name)
    );
    episode.stressAsymmetryMs = round(releaseAsymmetryMs, 4);
    episode.recoveryQualified = true;
  }

  return schedule;
}

export function generateRecoveryQualifiedStressSchedule(seed, options = {}) {
  return qualifyStressScheduleForRecovery(generateStressSchedule(seed, options));
}

export function runRecoveryQualifiedStressCampaign(options = {}) {
  const merged = { ...DEFAULT_STRESS_OPTIONS, ...options };
  const seedCount = Math.max(1, Math.floor(Number(merged.seeds)));
  const episodes = Math.max(1, Math.floor(Number(merged.episodes)));
  const profiles = Array.from(merged.profiles ?? DEFAULT_STRESS_OPTIONS.profiles).map(profileFrom);
  const schedules = Array.from({ length: seedCount }, (_, index) =>
    generateRecoveryQualifiedStressSchedule(runSeed(Number(merged.seed), index), { episodes })
  );
  const replays = [];

  for (const schedule of schedules) {
    for (const profile of profiles) replays.push(runLongHorizonReplay(schedule, profile, merged));
  }

  const failures = replays
    .filter((replay) => replay.unwantedTrip)
    .map((replay) => ({
      seed: replay.seed,
      profileId: replay.profileId,
      episodesToFirstTrip: replay.episodesToFirstTrip,
      firstTrip: replay.firstTrip,
      replayCommand: `npm run benchmark:stress -- --seeds 1 --episodes ${episodes} --seed ${replay.seed} --profiles ${replay.profileId}`
    }));

  return {
    format: 'line-differential-relay-lab-long-horizon-stress',
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    campaign: {
      masterSeed: Number(merged.seed),
      seeds: seedCount,
      episodesPerSeed: episodes,
      profiles: profiles.map((profile) => profile.id),
      replayCount: replays.length,
      totalEpisodeExposures: replays.length * episodes,
      stepMs: Number(merged.stepMs),
      methodology: 'Stateful recovery-qualified exposure: link flapping and packet disorder, partial recovery, sustained recovery, severe jitter, a second healthy burst, rapid one-way asymmetry redistribution, then high through/external current.',
      recoveryQualification: 'Two clean recovery phases allow generic supervised policies to reopen through their own state machines before the final asymmetry shock.',
      accelerationNotice: 'Healthy idle intervals are compressed into equivalent exposure time. Protection timers and estimator state are advanced only through explicitly simulated stress phases.',
      safetyBoundary: 'No operation is forced. Ground truth is evaluator-only and cannot affect alignment, confidence, protection permission, Idiff, persistence, or trip.',
      vendorNotice: 'Profiles are generic research policies and do not reproduce or claim equivalence with any manufacturer relay algorithm.',
      certificationNotice: 'Extreme simulation evidence only; not relay certification or field reliability proof.'
    },
    summary: summarizeStressReplays(replays, profiles, episodes),
    failures,
    schedules: merged.includeReplayDetails ? schedules : undefined,
    replays: merged.includeReplayDetails ? replays : undefined
  };
}
