import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALGORITHM_MODES,
  PROTECTION_STATES,
  SECURITY_POLICIES,
  createDefaultConfig
} from '../src/engine/constants.js';
import { ProtectionStateMachine } from '../src/engine/state-machine.js';
import {
  STRESS_PROFILE_IDS,
  formatLongHorizonStressMarkdown,
  generateStressSchedule,
  runLongHorizonReplay,
  runLongHorizonStressCampaign
} from '../src/validation/long-horizon-stress.js';

test('long-horizon schedule generation is deterministic and stateful by episode', () => {
  const first = generateStressSchedule(87161850, { episodes: 12 });
  const second = generateStressSchedule(87161850, { episodes: 12 });
  assert.deepEqual(first, second);
  assert.equal(first.schedule.length, 12);
  assert.equal(first.schedule[10].criticalOpportunity, true);
  assert.deepEqual(
    first.schedule[0].phases.map((phase) => phase.name),
    [
      'link-flap',
      'partial-recovery',
      'deceptive-recovery',
      'asymmetric-route-flip',
      'jitter-storm',
      'high-through-current-release',
      'post-event-settle'
    ]
  );
});

test('P5 schedules contain no internal-fault operation target', () => {
  const schedule = generateStressSchedule(87161851, { episodes: 20 });
  for (const episode of schedule.schedule) {
    for (const phase of episode.phases) {
      assert.notEqual(phase.patch.scenario, 'internal-fault');
    }
  }
});

test('fixed observation window releases soft degradation after its configured interval', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SECURE_WINDOW,
    securityPolicy: SECURITY_POLICIES.FIXED_OBSERVATION_WINDOW,
    secureWindowMs: 40
  };
  const machine = new ProtectionStateMachine(config);
  const confidence = {
    minimumScore: 50,
    hardInvalid: false,
    trustedElectricalHold: false,
    reasons: ['ALIGNMENT_UNCERTAIN']
  };

  assert.equal(machine.update({ config, confidence, deltaMs: 20 }).state, PROTECTION_STATES.SECURE);
  assert.equal(machine.update({ config, confidence, deltaMs: 20 }).state, PROTECTION_STATES.SECURE);
  assert.equal(machine.update({ config, confidence, deltaMs: 20 }).state, PROTECTION_STATES.NORMAL);
});

test('hard-invalid communication remains a veto for fixed observation policy', () => {
  const config = {
    ...createDefaultConfig(),
    algorithm: ALGORITHM_MODES.SECURE_WINDOW,
    securityPolicy: SECURITY_POLICIES.FIXED_OBSERVATION_WINDOW
  };
  const machine = new ProtectionStateMachine(config);
  const confidence = {
    minimumScore: 90,
    hardInvalid: true,
    trustedElectricalHold: false,
    reasons: ['PACKET_INTEGRITY_FAIL']
  };
  assert.equal(machine.update({ config, confidence, deltaMs: 20 }).state, PROTECTION_STATES.BLOCKED);
  assert.equal(machine.snapshot().permission, 'BLOCKED');
});

test('one stateful stress replay is deterministic', () => {
  const schedule = generateStressSchedule(87161852, { episodes: 4 });
  const first = runLongHorizonReplay(schedule, STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED, {
    stepMs: 20,
    warmupMs: 200
  });
  const second = runLongHorizonReplay(schedule, STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED, {
    stepMs: 20,
    warmupMs: 200
  });
  assert.deepEqual(first, second);
  assert.equal(first.episodesScheduled, 4);
  assert.ok(first.stateTransitionCount > 0);
});

test('compact P5 campaign produces auditable summaries and Markdown', () => {
  const report = runLongHorizonStressCampaign({
    seed: 87161853,
    seeds: 1,
    episodes: 3,
    profiles: [
      STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED,
      STRESS_PROFILE_IDS.FIXED_OBSERVATION_WINDOW,
      STRESS_PROFILE_IDS.SMART_WAVEFORM
    ],
    includeReplayDetails: false,
    warmupMs: 160
  });
  assert.equal(report.campaign.replayCount, 3);
  assert.equal(report.schedules, undefined);
  assert.equal(report.replays, undefined);
  assert.ok(report.summary[STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED]);
  assert.ok(report.summary[STRESS_PROFILE_IDS.FIXED_OBSERVATION_WINDOW]);
  assert.ok(report.summary[STRESS_PROFILE_IDS.SMART_WAVEFORM]);
  const markdown = formatLongHorizonStressMarkdown(report);
  assert.match(markdown, /Accelerated Long-Horizon 87L Stress Report/);
  assert.match(markdown, /No trip is forced/);
  assert.match(markdown, /Generic research profiles only/);
});
