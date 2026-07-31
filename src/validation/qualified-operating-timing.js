import {
  ALGORITHM_MODES,
  PROTECTION_STATES,
  createDefaultConfig
} from '../engine/constants.js';
import { Simulator } from '../engine/simulation.js';

function runPhase(simulator, phaseDefinition, stepMs) {
  simulator.setConfig(phaseDefinition.patch);
  let frame = null;
  const steps = Math.max(1, Math.ceil(phaseDefinition.durationMs / stepMs));
  for (let index = 0; index < steps; index += 1) frame = simulator.step(stepMs);
  return frame;
}

/**
 * Replays one deterministic internal-fault case and measures two different
 * timing domains:
 *
 * 1. faultToTripMs includes any initial revalidation or availability delay;
 * 2. qualifiedOperatingLatencyMs starts at the final continuous trip-permission
 *    streak that actually leads to operation.
 *
 * Keeping these separate prevents a SECURE-at-fault case from being described
 * as a slow differential characteristic while still exposing the full delay.
 */
export function runQualifiedOperatingTiming(testCase, options = {}) {
  const stepMs = Math.max(5, Number(options.stepMs ?? 20));
  const faultMs = Math.max(100, Number(options.faultMs ?? 360));
  const simulator = new Simulator({
    ...createDefaultConfig(),
    ...testCase.preparationPhases[0].patch,
    algorithm: ALGORITHM_MODES.SMART_TRACKING,
    seed: testCase.seed
  });

  let preFaultFrame = null;
  for (const phaseDefinition of testCase.preparationPhases) {
    preFaultFrame = runPhase(simulator, phaseDefinition, stepMs);
  }

  const preFaultOperationallyAvailable =
    preFaultFrame.protection.state === PROTECTION_STATES.NORMAL ||
    preFaultFrame.protection.degraded === true;

  simulator.setConfig(testCase.faultPatch);
  const faultSteps = Math.max(1, Math.ceil(faultMs / stepMs));
  let currentTripAllowedStreakFrames = 0;
  let currentTripAllowedStreakStartMs = null;
  let maximumConsecutiveTripAllowedFrames = 0;
  let firstTripAllowedMs = null;
  let faultToTripMs = null;
  let operatingPermissionStartMs = null;
  let qualifiedOperatingLatencyMs = null;

  for (let index = 0; index < faultSteps; index += 1) {
    const frame = simulator.step(stepMs);
    const elapsedMs = (index + 1) * stepMs;

    if (frame.protection.tripAllowed) {
      if (currentTripAllowedStreakFrames === 0) currentTripAllowedStreakStartMs = elapsedMs;
      currentTripAllowedStreakFrames += 1;
      maximumConsecutiveTripAllowedFrames = Math.max(
        maximumConsecutiveTripAllowedFrames,
        currentTripAllowedStreakFrames
      );
      if (firstTripAllowedMs === null) firstTripAllowedMs = elapsedMs;
    } else {
      currentTripAllowedStreakFrames = 0;
      currentTripAllowedStreakStartMs = null;
    }

    if (frame.protection.operate && faultToTripMs === null) {
      faultToTripMs = elapsedMs;
      operatingPermissionStartMs = currentTripAllowedStreakStartMs;
      qualifiedOperatingLatencyMs = currentTripAllowedStreakStartMs === null
        ? null
        : elapsedMs - currentTripAllowedStreakStartMs + stepMs;
    }
  }

  return {
    caseId: testCase.id,
    preFaultOperationallyAvailable,
    preFaultState: preFaultFrame.protection.state,
    preFaultDisplayState: preFaultFrame.protection.displayState,
    preFaultPermission: preFaultFrame.protection.permission,
    firstTripAllowedMs,
    maximumConsecutiveTripAllowedFrames,
    faultToTripMs,
    operatingPermissionStartMs,
    qualifiedOperatingLatencyMs
  };
}
