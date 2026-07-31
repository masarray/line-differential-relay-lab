import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRESS_PROFILE_IDS
} from '../src/validation/long-horizon-stress.js';
import {
  generateRecoveryQualifiedStressSchedule,
  runRecoveryQualifiedStressCampaign
} from '../src/validation/recovery-qualified-stress.js';

test('recovery-qualified P5 waits for supervised recovery before the asymmetry shock', () => {
  const schedule = generateRecoveryQualifiedStressSchedule(87161850, { episodes: 12 });
  const critical = schedule.schedule.find((episode) => episode.criticalOpportunity);
  assert.ok(critical);
  assert.equal(critical.recoveryQualified, true);

  const recovery = critical.phases.find((phase) => phase.name === 'deceptive-recovery');
  const jitter = critical.phases.find((phase) => phase.name === 'jitter-storm');
  const routeFlip = critical.phases.find((phase) => phase.name === 'asymmetric-route-flip');
  const release = critical.phases.find((phase) => phase.name === 'high-through-current-release');

  assert.ok(recovery.durationMs >= 520);
  assert.equal(recovery.patch.packetLossPct, 0);
  assert.equal(recovery.patch.reorderPct, 0);
  assert.ok(Math.abs(jitter.patch.asymmetryMs) <= 2.6);
  assert.ok(Math.abs(routeFlip.patch.asymmetryMs) >= 11.2);
  assert.ok(Math.abs(release.patch.asymmetryMs) >= 11.2);
  assert.equal(release.patch.packetLossPct, 0);
  assert.equal(release.patch.reorderPct, 0);
});

test('recovery-qualified campaign remains deterministic', () => {
  const options = {
    seed: 87161854,
    seeds: 1,
    episodes: 4,
    profiles: [STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED],
    includeReplayDetails: true,
    warmupMs: 160
  };
  const first = runRecoveryQualifiedStressCampaign(options);
  const second = runRecoveryQualifiedStressCampaign(options);
  first.generatedAt = 'stable';
  second.generatedAt = 'stable';
  assert.deepEqual(first, second);
});
