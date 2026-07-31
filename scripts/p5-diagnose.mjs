import { ALGORITHM_MODES, createDefaultConfig } from '../src/engine/constants.js';
import { Simulator } from '../src/engine/simulation.js';
import {
  DEFAULT_STRESS_PROFILES,
  STRESS_PROFILE_IDS
} from '../src/validation/long-horizon-stress.js';
import { generateRecoveryQualifiedStressSchedule } from '../src/validation/recovery-qualified-stress.js';

const seed = 915549860;
const schedule = generateRecoveryQualifiedStressSchedule(seed, { episodes: 30 });
const profile = DEFAULT_STRESS_PROFILES.find((candidate) =>
  candidate.id === STRESS_PROFILE_IDS.COMMUNICATION_SUPERVISED
);
const simulator = new Simulator({
  ...createDefaultConfig(),
  ...schedule.baselinePatch,
  ...profile.settings,
  seed,
  algorithm: profile.algorithm,
  securityPolicy: profile.securityPolicy
});
const stepMs = 20;
for (let index = 0; index < 21; index += 1) simulator.step(stepMs);

for (const episode of schedule.schedule) {
  for (const phase of episode.phases) {
    simulator.setConfig({
      ...phase.patch,
      ...profile.settings,
      algorithm: profile.algorithm,
      securityPolicy: profile.securityPolicy
    });
    const steps = Math.max(1, Math.ceil(phase.durationMs / stepMs));
    const diagnostic = {
      phase: phase.name,
      durationMs: phase.durationMs,
      startState: null,
      endState: null,
      startPermission: null,
      endPermission: null,
      hardInvalidFrames: 0,
      tripAllowedFrames: 0,
      operateFrames: 0,
      maxRatio: 0,
      maxFaultEvidence: 0,
      minChannel: 100,
      minAlignment: 100,
      minWaveform: 100,
      reasons: new Set()
    };
    for (let index = 0; index < steps; index += 1) {
      const frame = simulator.step(stepMs);
      if (index === 0) {
        diagnostic.startState = frame.protection.state;
        diagnostic.startPermission = frame.protection.permission;
      }
      diagnostic.endState = frame.protection.state;
      diagnostic.endPermission = frame.protection.permission;
      diagnostic.hardInvalidFrames += frame.confidence.hardInvalid ? 1 : 0;
      diagnostic.tripAllowedFrames += frame.protection.tripAllowed ? 1 : 0;
      diagnostic.operateFrames += frame.protection.operate ? 1 : 0;
      diagnostic.maxRatio = Math.max(
        diagnostic.maxRatio,
        frame.differential.validatedRmsPu / Math.max(0.01, frame.differential.activeThresholdPu)
      );
      diagnostic.maxFaultEvidence = Math.max(diagnostic.maxFaultEvidence, frame.differential.faultEvidence);
      diagnostic.minChannel = Math.min(diagnostic.minChannel, frame.confidence.channel.score);
      diagnostic.minAlignment = Math.min(diagnostic.minAlignment, frame.confidence.alignment.score);
      diagnostic.minWaveform = Math.min(diagnostic.minWaveform, frame.confidence.waveform.score);
      for (const reason of frame.confidence.reasons) diagnostic.reasons.add(reason);
    }
    diagnostic.maxRatio = Number(diagnostic.maxRatio.toFixed(4));
    diagnostic.maxFaultEvidence = Number(diagnostic.maxFaultEvidence.toFixed(4));
    diagnostic.minChannel = Number(diagnostic.minChannel.toFixed(2));
    diagnostic.minAlignment = Number(diagnostic.minAlignment.toFixed(2));
    diagnostic.minWaveform = Number(diagnostic.minWaveform.toFixed(2));
    diagnostic.reasons = [...diagnostic.reasons];

    if (episode.criticalOpportunity) {
      console.log(`P5-DIAG ${episode.id} ${JSON.stringify(diagnostic)}`);
    }
  }
  if (episode.criticalOpportunity) break;
}
